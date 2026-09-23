//! 角色与工具集合决策（不短路 Agent Loop）。

use tauri::{AppHandle, State};

use super::mode::{self, ChatMode};
use crate::core::tools;
use crate::agents::AgentState;
use crate::core::intent::Intent;
use crate::core::memory::save_snapshot;

/// 返回 (本轮 agent_id, 是否建议写入会话)。
///
/// 优先级：会话已绑定 → 用户显式指定 →（Ask/Search）全局激活/首个启用 →（Agent）按意图选角。
pub fn resolve_turn_agent(
    state: &State<'_, AgentState>,
    session_id: &Option<String>,
    mode: ChatMode,
    intent: &Intent,
    preferred_agent_id: Option<&str>,
) -> (Option<String>, Option<String>) {
    if let Some(sid) = session_id {
        if let Some(bound) = state
            .sessions
            .lock()
            .unwrap()
            .get(sid)
            .and_then(|s| s.agent_id.clone())
        {
            return (Some(bound), None);
        }
    }

    if let Some(pref) = preferred_agent_id.map(str::trim).filter(|s| !s.is_empty()) {
        if let Some(id) = resolve_enabled_agent_id(state, pref) {
            let bind = if mode.use_tools() {
                Some(id.clone())
            } else {
                None
            };
            return (Some(id), bind);
        }
    }

    if !mode.use_tools() {
        let active = state.config.lock().unwrap().active_agent_id.clone();
        let agents = state.agents.lock().unwrap();
        let id = active.or_else(|| agents.iter().find(|a| a.enabled).map(|a| a.id.clone()));
        return (id, None);
    }

    let active = state.config.lock().unwrap().active_agent_id.clone();
    let agents = state.agents.lock().unwrap();
    let picked = mode::pick_agent_for_intent(&agents, intent, active.as_deref());
    let id = picked.map(|a| a.id);
    (id.clone(), id)
}

fn resolve_enabled_agent_id(state: &State<'_, AgentState>, key: &str) -> Option<String> {
    let agents = state.agents.lock().unwrap();
    agents
        .iter()
        .find(|a| a.enabled && (a.id == key || a.slug == key))
        .map(|a| a.id.clone())
}

/// 将会话绑到指定 Agent，并同步 workspace（跟随档案目录）。
pub async fn maybe_bind_session_agent(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    agent_id: &str,
) {
    let workspace = {
        let agents = state.agents.lock().unwrap();
        agents
            .iter()
            .find(|a| a.id == agent_id && a.enabled)
            .and_then(|a| a.workspace_dir.clone())
    };
    let should_save = {
        let mut sessions = state.sessions.lock().unwrap();
        let Some(s) = sessions.get_mut(sid) else {
            return;
        };
        if s.agent_id.as_deref() == Some(agent_id) {
            // 已绑同一角色时，仍补齐缺失的 workspace
            if s.workspace_dir.is_none() {
                if let Some(ws) = workspace {
                    s.workspace_dir = Some(ws);
                    true
                } else {
                    false
                }
            } else {
                false
            }
        } else if s.agent_id.is_some() {
            // 已绑定其它角色：不在 decision 里静默覆盖（改角走 session_set_agent）
            false
        } else {
            s.agent_id = Some(agent_id.to_string());
            if let Some(ws) = workspace {
                s.workspace_dir = Some(ws);
            }
            true
        }
    };
    if should_save {
        save_snapshot(app, state, sid).await;
    }
}

pub fn resolve_active_agent(
    state: &State<'_, AgentState>,
    agent_id: Option<&str>,
) -> Option<crate::agents::AgentProfile> {
    let active_id = state.config.lock().unwrap().active_agent_id.clone();
    let agents = state.agents.lock().unwrap();
    if let Some(id) = agent_id {
        if let Some(a) = agents.iter().find(|a| a.id == id && a.enabled) {
            return Some(a.clone());
        }
        if let Some(a) = agents.iter().find(|a| a.slug == id && a.enabled) {
            return Some(a.clone());
        }
    }
    if let Some(id) = &active_id {
        if let Some(a) = agents.iter().find(|a| &a.id == id && a.enabled) {
            return Some(a.clone());
        }
    }
    agents.iter().find(|a| a.enabled).cloned()
}

pub async fn collect_tools(state: &State<'_, AgentState>) -> Vec<tools::ToolDef> {
    let mut t = tools::all_tools();
    t.extend(state.mcp.lock().await.all_api_tools());
    t
}
