//! 一轮对话总编排（类似 DispatcherServlet）。
//!
//! 只定顶层顺序；`execute` 嵌在 `plan` 的 Agent Loop 内，不单独占一层。

use anyhow::Result;
use tauri::{AppHandle, State};

use crate::agents::AgentState;
use crate::chat::ChatAttachment;
use crate::core::context::TurnContext;
use crate::core::{decision, intent, pipeline, plan, response, session};

/// 开始一轮对话。
///
/// ```text
/// session → intent → decision → plan[ script_turn → loop ⇄ execute ] → response(trace)
/// ```
pub async fn run(
    app: AppHandle,
    _state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
    mode: Option<String>,
    group_id: Option<String>,
    agent_id: Option<String>,
    attachments: Option<Vec<ChatAttachment>>,
) -> Result<String> {
    let mut ctx = TurnContext::new(
        app,
        session_id,
        content,
        mode,
        group_id,
        agent_id,
        attachments.unwrap_or_default(),
    );

    let layers = async {
        pipeline::run_layer(&mut ctx, "session", |c| Box::pin(session::run(c))).await?;
        pipeline::run_layer(&mut ctx, "intent", |c| Box::pin(intent::run(c))).await?;
        pipeline::run_layer(&mut ctx, "decision", |c| Box::pin(decision::run(c))).await?;
        pipeline::run_layer(&mut ctx, "plan", |c| Box::pin(plan::run(c))).await?;
        Ok::<(), anyhow::Error>(())
    }
    .await;

    // 无论成败都尝试落库链路（有 trace 时）；助手正文已在 plan 内写入
    let _ = response::run(&mut ctx).await;

    layers?;
    ctx.sid
        .ok_or_else(|| anyhow::anyhow!("session id missing after turn"))
}
