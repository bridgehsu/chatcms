//! 一轮对话总编排（类似 DispatcherServlet）。
//!
//! 只定层级顺序；细节在各层 `run`。

use anyhow::Result;
use tauri::{AppHandle, State};

use crate::agents::AgentState;
use crate::core::context::TurnContext;
use crate::core::{decision, intent, pipeline, plan, response, session};

/// 开始一轮对话：session → intent → decision → plan → response。
///
/// 先确保会话壳并写入用户消息；意图与决策之后再绑角色 / 工具。
pub async fn start_turn(
    app: AppHandle,
    _state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
    mode: Option<String>,
    group_id: Option<String>,
    agent_id: Option<String>,
) -> Result<String> {
    let mut ctx = TurnContext::new(app, session_id, content, mode, group_id, agent_id);

    let layers = async {
        pipeline::before(&mut ctx, "session");
        let r = session::run(&mut ctx).await;
        pipeline::after(&mut ctx, "session", &r);
        r?;

        pipeline::before(&mut ctx, "intent");
        let r = intent::run(&mut ctx).await;
        pipeline::after(&mut ctx, "intent", &r);
        r?;

        pipeline::before(&mut ctx, "decision");
        let r = decision::run(&mut ctx).await;
        pipeline::after(&mut ctx, "decision", &r);
        r?;

        pipeline::before(&mut ctx, "plan");
        let r = plan::run(&mut ctx).await;
        pipeline::after(&mut ctx, "plan", &r);
        r?;

        Ok::<(), anyhow::Error>(())
    }
    .await;

    // 无论成败都尝试落库链路（有 trace 时）
    let _ = response::run(&mut ctx).await;

    layers?;
    ctx.sid
        .ok_or_else(|| anyhow::anyhow!("session id missing after turn"))
}
