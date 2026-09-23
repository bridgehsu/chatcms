//! 会话层：确保会话壳、写入用户消息、启动本轮链路。
//!
//! 不按意图绑角色；绑定在 decision 层完成。

use anyhow::Result;
use tauri::Manager;

use crate::agents::AgentState;
use crate::chat::service;
use crate::chat::trace::ChatTrace;
use crate::core::context::TurnContext;
use crate::core::decision::ChatMode;

/// 层入口：先于意图，只建立/复用会话并记账。
pub async fn run(ctx: &mut TurnContext) -> Result<()> {
    // 模式来自用户选择，不依赖意图，此处即可解析供 trace 使用。
    ctx.mode = ChatMode::parse(ctx.mode_raw.as_deref().unwrap_or("ask"));

    let create_group_id = if ctx.session_id_in.is_none() {
        ctx.group_id_in.clone()
    } else {
        None
    };

    let app = ctx.app.clone();
    let state = app.state::<AgentState>();
    // 仅 ensure 会话壳；未预绑时角色留给 decision（会话已绑定则沿用）。
    let sid = service::ensure_session(
        &app,
        &state,
        ctx.session_id_in.clone(),
        create_group_id,
        ctx.agent_id_in.clone(),
    )
    .await;

    let mut trace = ChatTrace::start(&sid, ctx.content.chars().count());
    trace.chat_mode = ctx.mode.as_str().to_string();
    trace.mark(
        "ensure_session",
        format!("session_id={sid} mode={}", ctx.mode.as_str()),
    );

    service::push_user_message(&app, &state, &sid, &ctx.content).await;
    trace.mark("push_user_message", "");

    let (workspace_dir, session_agent_id) = {
        let sessions = state.sessions.lock().unwrap();
        let session = sessions.get(&sid);
        (
            session.and_then(|s| s.workspace_dir.clone()),
            session.and_then(|s| s.agent_id.clone()),
        )
    };

    ctx.sid = Some(sid);
    ctx.workspace_dir = workspace_dir;
    ctx.session_agent_id = session_agent_id;
    ctx.trace = Some(trace);
    Ok(())
}
