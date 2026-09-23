//! 把内存中的会话快照写入 SQLite。

use tauri::AppHandle;

use crate::agents::AgentState;
use crate::chat::repository as repo;

pub async fn save_snapshot(app: &AppHandle, state: &AgentState, sid: &str) {
    let session = state.sessions.lock().unwrap().get(sid).cloned();
    if let Some(s) = session {
        repo::save(app, &s).await;
    }
}
