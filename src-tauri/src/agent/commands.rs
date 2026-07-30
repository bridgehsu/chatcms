use super::AgentState;
use crate::memory::Session;
use crate::persist;
use serde_json::json;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn chat_send(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
) -> Result<String, String> {
    super::send_message(app, state, session_id, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn session_list(state: State<'_, AgentState>) -> Vec<serde_json::Value> {
    let sessions = state.sessions.lock().unwrap();
    let mut list: Vec<Session> = sessions.values().cloned().collect();
    list.sort_by(|a, b| match (a.pinned, b.pinned) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.updated_at.cmp(&a.updated_at),
    });
    list.iter()
        .map(|s| {
            json!({
                "id": s.id,
                "title": s.title,
                "updated_at": s.updated_at,
                "message_count": s.messages.len(),
                "pinned": s.pinned,
            })
        })
        .collect()
}

#[tauri::command]
pub fn session_get(state: State<'_, AgentState>, session_id: String) -> Option<Session> {
    state.sessions.lock().unwrap().get(&session_id).cloned()
}

#[tauri::command]
pub fn session_delete(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if sessions.remove(&session_id).is_none() {
        return Err("会话不存在".into());
    }
    persist::save_sessions(&app, &sessions);
    Ok(())
}

#[tauri::command]
pub fn session_rename(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    let trimmed = title.trim().to_string();
    if trimmed.is_empty() {
        return Err("标题不能为空".into());
    }
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "会话不存在".to_string())?;
    session.title = trimmed;
    session.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    persist::save_sessions(&app, &sessions);
    Ok(())
}

#[tauri::command]
pub fn session_pin(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    pinned: bool,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "会话不存在".to_string())?;
    session.pinned = pinned;
    persist::save_sessions(&app, &sessions);
    Ok(())
}
