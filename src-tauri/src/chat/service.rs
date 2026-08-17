use tauri::AppHandle;

use super::{now_secs, repository as repo, Role, Session};
use crate::agent::core::state::AgentState;

/// 确保会话存在，不存在则新建（锁定当前 agent 的 workspace）并持久化。
pub async fn ensure_session(
    app: &AppHandle,
    state: &AgentState,
    session_id: Option<String>,
    agent_id: Option<String>,
) -> String {
    let (sid, new_session) = {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(id) = session_id {
            if sessions.contains_key(&id) {
                return id;
            }
        }
        // 解析 workspace_dir：优先用指定 agent_id，其次 active_agent_id，最后第一个启用 agent
        let active_agent_id = state.config.lock().unwrap().active_agent_id.clone();
        let workspace_dir = {
            let agents = state.agents.lock().unwrap();
            agents.iter()
                .find(|a| {
                    agent_id.as_deref().map_or(false, |id| a.id == id) && a.enabled
                })
                .or_else(|| {
                    agents.iter().find(|a| {
                        active_agent_id.as_deref().map_or(false, |id| a.id == id) && a.enabled
                    })
                })
                .or_else(|| agents.iter().find(|a| a.enabled))
                .and_then(|a| a.workspace_dir.clone())
        };
        let s = match agent_id {
            Some(aid) => Session::new_with_agent("New Chat", aid, workspace_dir),
            None => {
                let mut s = Session::new("New Chat");
                s.workspace_dir = workspace_dir;
                s
            }
        };
        let sid = s.id.clone();
        let clone = s.clone();
        sessions.insert(sid.clone(), s);
        (sid, clone)
    };
    repo::save(app, &new_session).await;
    sid
}

/// 向会话追加用户消息并持久化。
pub async fn push_user_message(
    app: &AppHandle,
    state: &AgentState,
    sid: &str,
    content: &str,
) {
    {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::User, content);
        }
    }
    save_snapshot(app, state, sid).await;
}

/// 将内存中的会话快照写入 SQLite。
pub async fn save_snapshot(app: &AppHandle, state: &AgentState, sid: &str) {
    let session = state.sessions.lock().unwrap().get(sid).cloned();
    if let Some(s) = session {
        repo::save(app, &s).await;
    }
}

/// 列出会话（按置顶 → 最近更新排序），返回摘要 JSON。
pub fn list(state: &AgentState, agent_id: Option<String>) -> Vec<serde_json::Value> {
    let sessions = state.sessions.lock().unwrap();
    let mut list: Vec<Session> = sessions
        .values()
        .filter(|s| match &agent_id {
            Some(id) => s.agent_id.as_deref() == Some(id.as_str()),
            None => true,
        })
        .cloned()
        .collect();
    list.sort_by(|a, b| match (a.pinned, b.pinned) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.updated.cmp(&a.updated),
    });
    list.iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id,
                "title": s.title,
                "updated": s.updated,
                "message_count": s.messages.len(),
                "pinned": s.pinned,
                "agent_id": s.agent_id,
            })
        })
        .collect()
}

/// 返回完整会话（含 messages）。
pub fn get(state: &AgentState, session_id: &str) -> Option<Session> {
    state.sessions.lock().unwrap().get(session_id).cloned()
}

/// 从内存和 DB 中删除会话。
pub async fn delete(
    app: &AppHandle,
    state: &AgentState,
    session_id: &str,
) -> Result<(), String> {
    {
        let mut sessions = state.sessions.lock().unwrap();
        if sessions.remove(session_id).is_none() {
            return Err("会话不存在".into());
        }
    }
    repo::delete(app, session_id).await;
    Ok(())
}

/// 重命名会话标题并持久化。
pub async fn rename(
    app: &AppHandle,
    state: &AgentState,
    session_id: &str,
    title: String,
) -> Result<(), String> {
    let trimmed = title.trim().to_string();
    if trimmed.is_empty() {
        return Err("标题不能为空".into());
    }
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let s = sessions
            .get_mut(session_id)
            .ok_or_else(|| "会话不存在".to_string())?;
        s.title = trimmed;
        s.updated = now_secs();
        s.clone()
    };
    repo::save(app, &session).await;
    Ok(())
}

/// 设置会话置顶状态并持久化。
pub async fn pin(
    app: &AppHandle,
    state: &AgentState,
    session_id: &str,
    pinned: bool,
) -> Result<(), String> {
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let s = sessions
            .get_mut(session_id)
            .ok_or_else(|| "会话不存在".to_string())?;
        s.pinned = pinned;
        s.clone()
    };
    repo::save(app, &session).await;
    Ok(())
}
