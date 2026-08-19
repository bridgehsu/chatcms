use serde_json::Value;
use tauri::{AppHandle, State};

use super::{service, ProviderProfile};
use crate::agents::AgentState;

#[tauri::command]
pub async fn model_profile_list(app: AppHandle) -> Vec<ProviderProfile> {
    service::list(&app).await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn model_profile_add(
    app: AppHandle,
    name: String,
    kind: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    tier: String,
    weight: i64,
    context_window: i64,
    // 新增（可选，前端不传则使用默认值）
    capabilities: Option<Value>,
    thinking: Option<bool>,
    thinking_effort: Option<String>,
    temperature: Option<f64>,
    max_output_tokens: Option<i64>,
    extra_body: Option<Value>,
    tags: Option<Vec<String>>,
) -> Result<ProviderProfile, String> {
    service::add(
        &app,
        name, kind, api_key, model, base_url, tier, weight, context_window,
        capabilities, thinking, thinking_effort, temperature, max_output_tokens,
        extra_body, tags,
    )
    .await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn model_profile_update(
    app: AppHandle,
    id: String,
    name: String,
    kind: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    tier: String,
    weight: i64,
    context_window: i64,
    enabled: bool,
    // 新增（可选）
    capabilities: Option<Value>,
    thinking: Option<bool>,
    thinking_effort: Option<String>,
    temperature: Option<f64>,
    max_output_tokens: Option<i64>,
    extra_body: Option<Value>,
    tags: Option<Vec<String>>,
) -> Result<ProviderProfile, String> {
    service::update(
        &app,
        id, name, kind, api_key, model, base_url, tier, weight, context_window, enabled,
        capabilities, thinking, thinking_effort, temperature, max_output_tokens,
        extra_body, tags,
    )
    .await
}

#[tauri::command]
pub async fn model_profile_remove(app: AppHandle, id: String) -> Result<(), String> {
    service::remove(&app, id).await
}

/// 全局激活指定 profile（id=Some → 手动模式；id=None → auto 模式）
#[tauri::command]
pub fn model_profile_activate(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: Option<String>,
) -> Result<(), String> {
    let mut cfg = state.config.lock().unwrap();
    match id {
        Some(profile_id) => {
            cfg.active_profile_id = Some(profile_id);
            cfg.auto_mode = false;
        }
        None => {
            cfg.auto_mode = true;
        }
    }
    crate::persist::save_config(&app, &cfg);
    Ok(())
}

/// 手动为指定 Session 绑定固定 profile（绕过 auto 路由）
#[tauri::command]
pub async fn model_profile_pin_session(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    profile_id: Option<String>,
) -> Result<(), String> {
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let s = sessions.get_mut(&session_id).ok_or("会话不存在")?;
        s.profile_id = profile_id;
        s.clone()
    };
    crate::chat::repository::save(&app, &session).await;
    Ok(())
}
