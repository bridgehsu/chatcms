use super::{AppConfig, ProviderConfig, ProviderKind, ProviderProfile, ProviderProfileInfo};
use crate::agents::AgentState;
use crate::persist;
use tauri::{AppHandle, State};
use uuid::Uuid;

fn parse_provider_kind(provider: &str) -> ProviderKind {
    match provider {
        "openai" => ProviderKind::OpenAI,
        _ => ProviderKind::Anthropic,
    }
}

#[tauri::command]
pub fn config_get(state: State<'_, AgentState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn config_set(
    app: AppHandle,
    state: State<'_, AgentState>,
    api_key: String,
    model: String,
    provider: String,
    base_url: Option<String>,
) -> Result<(), String> {
    let kind = parse_provider_kind(&provider);
    let mut cfg = state.config.lock().unwrap();
    cfg.provider = ProviderConfig {
        kind,
        api_key,
        model,
        base_url,
    };
    cfg.ensure_profiles();
    cfg.upsert_active_from_provider();
    persist::save_config(&app, &cfg);
    Ok(())
}

#[tauri::command]
pub fn provider_list(state: State<'_, AgentState>) -> Vec<ProviderProfileInfo> {
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    cfg.profile_infos()
}

#[tauri::command]
pub fn provider_add(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> Result<ProviderProfileInfo, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    if model.trim().is_empty() {
        return Err("模型 ID 不能为空".into());
    }
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if cfg.profiles.iter().any(|p| p.name == name) {
        return Err(format!("已存在同名配置「{name}」"));
    }
    let profile = ProviderProfile {
        id: Uuid::new_v4().to_string(),
        name,
        kind: parse_provider_kind(&provider),
        api_key,
        model: model.trim().to_string(),
        base_url: base_url.filter(|s| !s.trim().is_empty()),
    };
    let id = profile.id.clone();
    cfg.profiles.push(profile);
    if cfg.active_profile_id.is_none() {
        cfg.active_profile_id = Some(id.clone());
        cfg.sync_active_provider();
    }
    persist::save_config(&app, &cfg);
    cfg.profile_infos()
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "添加失败".into())
}

#[tauri::command]
pub fn provider_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
    name: String,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> Result<ProviderProfileInfo, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    if model.trim().is_empty() {
        return Err("模型 ID 不能为空".into());
    }
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if cfg.profiles.iter().any(|p| p.name == name && p.id != id) {
        return Err(format!("已存在同名配置「{name}」"));
    }
    let profile = cfg
        .profiles
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "配置不存在".to_string())?;
    profile.name = name;
    profile.kind = parse_provider_kind(&provider);
    profile.api_key = api_key;
    profile.model = model.trim().to_string();
    profile.base_url = base_url.filter(|s| !s.trim().is_empty());
    if cfg.active_profile_id.as_deref() == Some(id.as_str()) {
        cfg.sync_active_provider();
    }
    persist::save_config(&app, &cfg);
    cfg.profile_infos()
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "更新失败".into())
}

#[tauri::command]
pub fn provider_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if cfg.profiles.len() <= 1 {
        return Err("至少保留一条模型配置".into());
    }
    if !cfg.profiles.iter().any(|p| p.id == id) {
        return Err("配置不存在".into());
    }
    cfg.profiles.retain(|p| p.id != id);
    if cfg.active_profile_id.as_deref() == Some(id.as_str()) {
        cfg.active_profile_id = cfg.profiles.first().map(|p| p.id.clone());
        cfg.sync_active_provider();
    }
    persist::save_config(&app, &cfg);
    Ok(())
}

#[tauri::command]
pub fn provider_activate(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<ProviderProfileInfo, String> {
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if !cfg.profiles.iter().any(|p| p.id == id) {
        return Err("配置不存在".into());
    }
    cfg.active_profile_id = Some(id.clone());
    cfg.auto_mode = false;
    cfg.sync_active_provider();
    persist::save_config(&app, &cfg);
    cfg.profile_infos()
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "激活失败".into())
}

/// 切换到 auto 路由模式（用户在 ModelPicker 选择"Auto"时调用）
#[tauri::command]
pub fn provider_set_auto(
    app: AppHandle,
    state: State<'_, AgentState>,
) -> Result<(), String> {
    let mut cfg = state.config.lock().unwrap();
    cfg.auto_mode = true;
    persist::save_config(&app, &cfg);
    Ok(())
}

#[allow(dead_code)]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("config")
        .invoke_handler(tauri::generate_handler![
            config_get,
            config_set,
            provider_list,
            provider_add,
            provider_update,
            provider_remove,
            provider_activate,
        ])
        .build()
}
