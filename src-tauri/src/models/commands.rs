use tauri::{AppHandle, State};

use super::{service, ProviderProfile};
use crate::agent::AgentState;

#[tauri::command]
pub async fn model_profile_list(app: AppHandle) -> Vec<ProviderProfile> {
    service::list(&app).await
}

#[tauri::command]
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
) -> Result<ProviderProfile, String> {
    service::add(&app, name, kind, api_key, model, base_url, tier, weight, context_window).await
}

#[tauri::command]
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
) -> Result<ProviderProfile, String> {
    service::update(&app, id, name, kind, api_key, model, base_url, tier, weight, context_window, enabled).await
}

#[tauri::command]
pub async fn model_profile_remove(app: AppHandle, id: String) -> Result<(), String> {
    service::remove(&app, id).await
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
