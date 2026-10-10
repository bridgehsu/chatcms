//! 横切钩子：每层进出记录 trace / 日志（类似 HandlerInterceptor）。

use anyhow::Result;
use futures_util::future::BoxFuture;

use super::context::TurnContext;

pub fn before(ctx: &mut TurnContext, name: &str) {
    log::debug!(target: "chatcms_lib::core", "layer enter name={name}");
    if let Some(trace) = ctx.trace.as_mut() {
        trace.mark(name, "enter");
    }
}

pub fn after(ctx: &mut TurnContext, name: &str, result: &Result<()>) {
    match result {
        Ok(()) => {
            log::debug!(target: "chatcms_lib::core", "layer ok name={name}");
            if let Some(trace) = ctx.trace.as_mut() {
                trace.mark(name, "ok");
            }
        }
        Err(e) => {
            log::warn!(target: "chatcms_lib::core", "layer err name={name}: {e:#}");
            if let Some(trace) = ctx.trace.as_mut() {
                trace.mark(name, format!("err={e:#}"));
            }
        }
    }
}

/// 统一一层进出钩子，避免 turn 里重复 before/after。
pub async fn run_layer(
    ctx: &mut TurnContext,
    name: &str,
    f: impl for<'a> FnOnce(&'a mut TurnContext) -> BoxFuture<'a, Result<()>>,
) -> Result<()> {
    before(ctx, name);
    let r = f(ctx).await;
    after(ctx, name, &r);
    r
}
