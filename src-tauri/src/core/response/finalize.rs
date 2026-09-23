//! 无 tool call 时写入助手回复。

use tauri::{AppHandle, State};

use crate::agents::AgentState;
use crate::core::memory::save_snapshot;
use crate::chat::Role;

pub async fn finalize_assistant_turn(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    text: &str,
) {
    if text.is_empty() {
        return;
    }
    {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::Assistant, text);
            if session.title == "New Chat" {
                session.title = text.chars().take(30).collect();
            }
        }
    }
    save_snapshot(app, &**state, sid).await;
}
