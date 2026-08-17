use super::Session;
use crate::agent::core::state::AgentState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn chat_send(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    agent_id: Option<String>,
    content: String,
) -> Result<String, String> {
    crate::agent::core::chat::send_message(app, state, session_id, agent_id, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn session_list(
    state: State<'_, AgentState>,
    agent_id: Option<String>,
) -> Vec<serde_json::Value> {
    super::service::list(&state, agent_id)
}

#[tauri::command]
pub fn session_get(
    state: State<'_, AgentState>,
    session_id: String,
) -> Option<Session> {
    super::service::get(&state, &session_id)
}

#[tauri::command]
pub async fn session_delete(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
) -> Result<(), String> {
    super::service::delete(&app, &state, &session_id).await
}

#[tauri::command]
pub async fn session_rename(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    super::service::rename(&app, &state, &session_id, title).await
}

#[tauri::command]
pub async fn session_pin(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    pinned: bool,
) -> Result<(), String> {
    super::service::pin(&app, &state, &session_id, pinned).await
}
