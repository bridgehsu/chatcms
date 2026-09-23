use super::{
    default_data_root, AppConfig, GeneralSettings, ProviderConfig, ProviderKind, ProviderProfile,
    ProviderProfileInfo,
};
use crate::agents::AgentState;
use crate::common::persist;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

/// 全局配置页视图（含默认数据目录提示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfigView {
    pub data_root: String,
    pub default_data_root: String,
    pub video_base_url: String,
    pub publish_bridge_port: u16,
    pub crawler_base_url: String,
    pub use_system_proxy: bool,
    pub http_proxy_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfigSetResult {
    pub config: GeneralConfigView,
    /// 改存储根或发布桥端口后需重启才对 DB / 桥生效
    pub restart_required: bool,
}

fn normalize_http_url(raw: &str, label: &str) -> Result<String, String> {
    let url = raw.trim().trim_end_matches('/').to_string();
    if url.is_empty() {
        return Err(format!("{label} 不能为空"));
    }
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(format!("{label} 需以 http:// 或 https:// 开头"));
    }
    Ok(url)
}

fn normalize_proxy_url(raw: &str) -> Result<String, String> {
    let url = raw.trim().to_string();
    if url.is_empty() {
        return Err("启用代理时必须填写代理地址".into());
    }
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("代理地址需以 http:// 或 https:// 开头（如 http://127.0.0.1:7890）".into());
    }
    // 校验可被 reqwest 解析
    reqwest::Proxy::all(&url).map_err(|e| format!("代理地址无效: {e}"))?;
    Ok(url)
}

fn to_view(app: &AppHandle, g: &GeneralSettings) -> GeneralConfigView {
    GeneralConfigView {
        data_root: g
            .data_root
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_default(),
        default_data_root: default_data_root(app).to_string_lossy().to_string(),
        video_base_url: g.video_base_url.clone(),
        publish_bridge_port: g.publish_bridge_port,
        crawler_base_url: g.crawler_base_url.clone(),
        use_system_proxy: g.use_system_proxy,
        http_proxy_url: g.http_proxy_url.clone(),
    }
}

fn sync_service_stores(app: &AppHandle, g: &GeneralSettings) {
    // 只写 sidecar store，避免在已持有 AgentState.config 锁时重入
    let mpt = crate::mpt::MptConfig {
        base_url: g.video_base_url.clone(),
    };
    if let Ok(val) = serde_json::to_value(&mpt) {
        persist::save_mpt_config(app, &val);
    }
    let crawler = crate::crawler::CrawlerConfig {
        base_url: g.crawler_base_url.clone(),
    };
    if let Ok(val) = serde_json::to_value(&crawler) {
        persist::save_crawler_config(app, &val);
    }
}

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

#[tauri::command]
pub fn general_config_get(app: AppHandle, state: State<'_, AgentState>) -> GeneralConfigView {
    let mut cfg = state.config.lock().unwrap();
    cfg.hydrate_general_from_legacy(&app);
    to_view(&app, &cfg.general)
}

#[tauri::command]
pub fn general_config_set(
    app: AppHandle,
    state: State<'_, AgentState>,
    data_root: String,
    video_base_url: String,
    publish_bridge_port: u16,
    crawler_base_url: String,
    use_system_proxy: bool,
    http_proxy_url: String,
) -> Result<GeneralConfigSetResult, String> {
    let video_base_url = normalize_http_url(&video_base_url, "视频服务地址")?;
    let crawler_base_url = normalize_http_url(&crawler_base_url, "采集服务地址")?;
    if publish_bridge_port < 1024 {
        return Err("发布桥端口需 ≥ 1024".into());
    }

    let http_proxy_url = if use_system_proxy {
        normalize_proxy_url(&http_proxy_url)?
    } else {
        http_proxy_url.trim().to_string()
    };

    let data_root_opt = {
        let t = data_root.trim();
        if t.is_empty() {
            None
        } else {
            let p = std::path::PathBuf::from(t);
            if p.exists() && !p.is_dir() {
                return Err("存储根路径已存在且不是目录".into());
            }
            std::fs::create_dir_all(&p).map_err(|e| format!("无法创建存储根目录: {e}"))?;
            Some(t.to_string())
        }
    };

    let mut cfg = state.config.lock().unwrap();
    let prev = cfg.general.clone();
    cfg.general = GeneralSettings {
        data_root: data_root_opt,
        video_base_url,
        publish_bridge_port,
        crawler_base_url,
        use_system_proxy,
        http_proxy_url,
    };
    let restart_required = prev.data_root != cfg.general.data_root
        || prev.publish_bridge_port != cfg.general.publish_bridge_port;
    let general = cfg.general.clone();
    persist::save_config(&app, &cfg);
    let view = to_view(&app, &general);
    drop(cfg);
    sync_service_stores(&app, &general);
    crate::common::provider::configure_http_client(
        general.use_system_proxy,
        &general.http_proxy_url,
    );
    Ok(GeneralConfigSetResult {
        config: view,
        restart_required,
    })
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
            general_config_get,
            general_config_set,
        ])
        .build()
}
