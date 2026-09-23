//! 响应层：落库本轮链路观测（助手正文已在 plan/execute 中写入）。

use anyhow::Result;

use crate::chat::repository as repo;
use crate::core::context::TurnContext;

/// 层入口：结束 trace 并持久化（成功或失败都尽量落库）。
pub async fn run(ctx: &mut TurnContext) -> Result<()> {
    let Some(mut trace) = ctx.trace.take() else {
        return Ok(());
    };

    if trace.error.is_none() {
        log::info!(
            target: "chatcms_lib::chat",
            "chat_send completed session_id={} total_ms={}",
            trace.session_id,
            trace.elapsed_ms(),
        );
        trace.finish_ok();
    }

    let record = trace.into_record();
    repo::save_turn_trace(&ctx.app, &record).await;
    Ok(())
}
