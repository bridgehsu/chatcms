//! 决策层：角色挑选、绑会话、本轮工具集合。
//!
//! 运行模式由 session 层解析并写入 [`TurnContext::mode`]，此处不再重复 parse。

use anyhow::Result;
use tauri::Manager;

use crate::agents::AgentState;
use crate::core::context::TurnContext;

use super::agent;

pub async fn run(ctx: &mut TurnContext) -> Result<()> {
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
        let mut tools = agent::collect_tools(&state).await;
        let mcp_filter = crate::chat::attachments::mcp_names(&ctx.attachments);
        if !mcp_filter.is_empty() {
            let mcp = state.mcp.lock().await;
            tools.retain(|t| {
                if !mcp.is_mcp_tool(&t.name) {
                    return true; // 保留内置工具
                }
                mcp_filter.iter().any(|server| {
                    t.name == *server || t.name.starts_with(&format!("{server}__"))
                })
            });
        }
        tools
    } else {
        Vec::new()
    };

    Ok(())
}
