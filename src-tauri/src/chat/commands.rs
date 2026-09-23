use super::Session;
use crate::agents::AgentState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn chat_send(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
    mode: Option<String>,
    group_id: Option<String>,
    agent_id: Option<String>,
) -> Result<String, String> {
    crate::core::start_turn(app, state, session_id, content, mode, group_id, agent_id)
        .await
        .map_err(|e| e.to_string())
}

/// 手动绑定 / 切换会话主 Agent（同步 workspace）。
#[tauri::command]
pub async fn session_set_agent(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    agent_id: String,
) -> Result<Session, String> {
    super::service::set_agent(&app, &state, &session_id, &agent_id).await
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

#[tauri::command]
pub async fn session_set_group(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    group_id: Option<String>,
) -> Result<(), String> {
    super::service::set_session_group(&app, &state, &session_id, group_id).await
}

#[tauri::command]
pub async fn session_group_list(app: AppHandle) -> Vec<super::SessionGroup> {
    super::service::list_groups(&app).await
}

#[tauri::command]
pub async fn session_group_create(
    app: AppHandle,
    name: String,
) -> Result<super::SessionGroup, String> {
    super::service::create_group(&app, name).await
}

#[tauri::command]
pub async fn session_group_rename(
    app: AppHandle,
    group_id: String,
    name: String,
) -> Result<super::SessionGroup, String> {
    super::service::rename_group(&app, group_id, name).await
}

#[tauri::command]
pub async fn session_group_delete(
    app: AppHandle,
    state: State<'_, AgentState>,
    group_id: String,
) -> Result<(), String> {
    super::service::delete_group(&app, &state, group_id).await
}

/// 中断正在运行的 Agent（⑧）。
#[tauri::command]
pub fn chat_abort(state: State<'_, AgentState>, session_id: String) {
    let handles = state.abort_handles.lock().unwrap();
    if let Some(tx) = handles.get(&session_id) {
        let _ = tx.send(true);
    }
}

/// 最近会话链路观测（运行观测 · 会话链路）
#[tauri::command]
pub async fn chat_trace_list(
    app: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<super::ChatTurnTrace>, String> {
    Ok(super::repository::list_turn_traces(&app, limit.unwrap_or(50) as i64).await)
}

/// 一次性文本补全（总结会话 / 笔记 AI 改稿；不写入会话）
#[tauri::command]
pub async fn chat_complete(
    app: AppHandle,
    state: State<'_, AgentState>,
    content: String,
    system_prompt: Option<String>,
) -> Result<String, String> {
    super::service::complete_text(&app, &state, system_prompt, content)
        .await
        .map_err(|e| e.to_string())
}
