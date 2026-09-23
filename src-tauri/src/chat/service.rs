use anyhow::Result;
use tauri::AppHandle;

use crate::core::memory::save_snapshot;
use crate::core::plan;
use super::{now_secs, repository as repo, Role, Session};
use crate::agents::AgentState;
use crate::common::provider;

// ── 会话 CRUD ─────────────────────────────────────────────────────────────────

/// 确保会话存在，不存在则新建（可选预绑 Agent；否则 workspace 暂取全局激活）并持久化。
/// 未预绑时角色留给 decision（会话已有 agent_id 则沿用，否则按用户指定 / 模式 / 意图挑选）。
pub async fn ensure_session(
    app: &AppHandle,
    state: &AgentState,
    session_id: Option<String>,
    group_id: Option<String>,
    preferred_agent_id: Option<String>,
) -> String {
    let (sid, new_session) = {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(id) = session_id {
            if sessions.contains_key(&id) {
                return id;
            }
        }

        let agents = state.agents.lock().unwrap();
        let preferred = preferred_agent_id.as_deref().and_then(|id| {
            agents
                .iter()
                .find(|a| a.enabled && (a.id == id || a.slug == id))
                .cloned()
        });
        let active_agent_id = state.config.lock().unwrap().active_agent_id.clone();
        let fallback = agents
            .iter()
            .find(|a| {
                active_agent_id.as_deref().map_or(false, |id| a.id == id) && a.enabled
            })
            .or_else(|| agents.iter().find(|a| a.enabled))
            .cloned();
        drop(agents);

        let mut s = Session::new("New Chat");
        if let Some(agent) = preferred {
            s.agent_id = Some(agent.id);
            s.workspace_dir = agent.workspace_dir;
        } else {
            s.workspace_dir = fallback.and_then(|a| a.workspace_dir);
        }
        s.group_id = group_id;
        let sid = s.id.clone();
        let clone = s.clone();
        sessions.insert(sid.clone(), s);
        (sid, clone)
    };
    // 分组合法性：无效 id 则清空后仍创建（避免阻断发消息）
    let mut session = new_session;
    if let Some(ref gid) = session.group_id {
        if repo::get_group(app, gid).await.is_none() {
            session.group_id = None;
            if let Some(s) = state.sessions.lock().unwrap().get_mut(&sid) {
                s.group_id = None;
            }
        }
    }
    repo::save(app, &session).await;
    sid
}

/// 切换会话主 Agent，并同步 workspace 到该档案目录。
pub async fn set_agent(
    app: &AppHandle,
    state: &AgentState,
    session_id: &str,
    agent_id: &str,
) -> Result<Session, String> {
    let key = agent_id.trim();
    if key.is_empty() {
        return Err("代理 id 不能为空".into());
    }
    let profile = {
        let agents = state.agents.lock().unwrap();
        agents
            .iter()
            .find(|a| a.enabled && (a.id == key || a.slug == key))
            .cloned()
            .ok_or_else(|| "代理不存在或未启用".to_string())?
    };

    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let s = sessions
            .get_mut(session_id)
            .ok_or_else(|| "会话不存在".to_string())?;
        s.agent_id = Some(profile.id.clone());
        if let Some(ws) = profile.workspace_dir.clone() {
            s.workspace_dir = Some(ws);
        }
        s.updated = super::now_secs();
        s.clone()
    };
    save_snapshot(app, state, session_id).await;
    Ok(session)
}

/// 向会话追加用户消息并持久化。
pub async fn push_user_message(app: &AppHandle, state: &AgentState, sid: &str, content: &str) {
    {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::User, content);
        }
    }
    save_snapshot(app, state, sid).await;
}

/// 列出会话（按置顶 → 最近更新排序），返回摘要 JSON。
pub fn list(state: &AgentState, agent_id: Option<String>) -> Vec<serde_json::Value> {
    let sessions = state.sessions.lock().unwrap();
    let mut list: Vec<&Session> = sessions
        .values()
        .filter(|s| match &agent_id {
            Some(id) => s.agent_id.as_deref() == Some(id.as_str()),
            None => true,
        })
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
                "group_id": s.group_id,
            })
        })
        .collect()
}

/// 设置会话所属分组（None = 移出分组）。
pub async fn set_session_group(
    app: &AppHandle,
    state: &AgentState,
    session_id: &str,
    group_id: Option<String>,
) -> Result<(), String> {
    if let Some(ref gid) = group_id {
        if repo::get_group(app, gid).await.is_none() {
            return Err("分组不存在".into());
        }
    }
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let s = sessions
            .get_mut(session_id)
            .ok_or_else(|| "会话不存在".to_string())?;
        s.group_id = group_id;
        s.updated = now_secs();
        s.clone()
    };
    repo::save(app, &session).await;
    Ok(())
}

pub async fn list_groups(app: &AppHandle) -> Vec<super::SessionGroup> {
    repo::list_groups(app).await
}

pub async fn create_group(app: &AppHandle, name: String) -> Result<super::SessionGroup, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("分组名称不能为空".into());
    }
    if trimmed.chars().count() > 40 {
        return Err("分组名称过长".into());
    }
    let now = now_secs();
    let g = super::SessionGroup {
        id: uuid::Uuid::new_v4().to_string(),
        name: trimmed,
        sort_order: repo::next_group_sort_order(app).await,
        created: now,
        updated: now,
    };
    repo::insert_group(app, &g).await?;
    Ok(g)
}

pub async fn rename_group(
    app: &AppHandle,
    group_id: String,
    name: String,
) -> Result<super::SessionGroup, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("分组名称不能为空".into());
    }
    if trimmed.chars().count() > 40 {
        return Err("分组名称过长".into());
    }
    let mut g = repo::get_group(app, &group_id)
        .await
        .ok_or_else(|| "分组不存在".to_string())?;
    g.name = trimmed;
    g.updated = now_secs();
    repo::update_group(app, &g).await?;
    Ok(g)
}

/// 删除分组：组内仍有会话时拒绝。
pub async fn delete_group(
    app: &AppHandle,
    state: &AgentState,
    group_id: String,
) -> Result<(), String> {
    if repo::get_group(app, &group_id).await.is_none() {
        return Err("分组不存在".into());
    }
    let count = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .values()
            .filter(|s| s.group_id.as_deref() == Some(group_id.as_str()))
            .count()
    };
    if count > 0 {
        return Err(format!(
            "分组下仍有 {count} 个会话，请先清理会话后再删除"
        ));
    }
    repo::delete_group(app, &group_id).await
}

/// 返回完整会话（含 messages）。
pub fn get(state: &AgentState, session_id: &str) -> Option<Session> {
    state.sessions.lock().unwrap().get(session_id).cloned()
}

/// 从内存和 DB 中删除会话。
pub async fn delete(app: &AppHandle, state: &AgentState, session_id: &str) -> Result<(), String> {
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

/// 一次性文本补全（不写入会话、不走 tools）。
pub async fn complete_text(
    app: &AppHandle,
    state: &AgentState,
    system_prompt: Option<String>,
    content: String,
) -> Result<String> {
    let content = content.trim().to_string();
    if content.is_empty() {
        anyhow::bail!("内容不能为空");
    }
    let profile = plan::resolve_profile(app, state, None, false, 2048).await?;
    provider::complete_chat(&profile, &content, system_prompt.as_deref()).await
}
