//! 决策层：模式确认、角色挑选、绑会话、本轮工具集合。

use anyhow::Result;
use tauri::Manager;

use crate::agents::AgentState;
use crate::core::context::TurnContext;

use super::agent;
use super::mode::ChatMode;

pub async fn run(ctx: &mut TurnContext) -> Result<()> {
    // session 可能已解析；此处再确认一次，保持幂等。
    ctx.mode = ChatMode::parse(ctx.mode_raw.as_deref().unwrap_or("ask"));
    if let Some(trace) = ctx.trace.as_mut() {
        trace.chat_mode = ctx.mode.as_str().to_string();
    }

    let intent = ctx
        .intent
        .clone()
        .ok_or_else(|| anyhow::anyhow!("intent missing before decision"))?;

    let session_id = ctx.sid.clone().or_else(|| ctx.session_id_in.clone());
    let mode = ctx.mode;

    let app = ctx.app.clone();
    let state = app.state::<AgentState>();

    let (resolved_agent_id, bind_on_create) =
        agent::resolve_turn_agent(&state, &session_id, mode, &intent, ctx.agent_id_in.as_deref());
    ctx.resolved_agent_id = resolved_agent_id;
    ctx.bind_on_create = bind_on_create;

    if ctx.mode.use_tools() {
        if let (Some(sid), Some(aid)) = (
            ctx.sid.clone(),
            ctx.bind_on_create
                .clone()
                .or(ctx.resolved_agent_id.clone()),
        ) {
            agent::maybe_bind_session_agent(&app, &state, &sid, &aid).await;
        }
    }

    // 绑定后刷新 workspace / agent，供 plan 使用。
    if let Some(sid) = ctx.sid.as_deref() {
        let sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get(sid) {
            ctx.workspace_dir = session.workspace_dir.clone();
            ctx.session_agent_id = session
                .agent_id
                .clone()
                .or(ctx.resolved_agent_id.clone());
        }
    } else {
        ctx.session_agent_id = ctx.resolved_agent_id.clone();
    }

    ctx.tools = if ctx.mode.use_tools() {
        agent::collect_tools(&state).await
    } else {
        Vec::new()
    };

    Ok(())
}
