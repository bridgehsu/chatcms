//! 会话意图识别（软路由，不短路 Agent Loop）。
//!
//! 热路径：
//! ```text
//! normalize → score（规则打分+置信） → finalize（富化/校验/兜底） → Intent
//! ```
//!
//! 规则 CRUD / 缓存 / 评测见同目录 `service`、`repository`、`commands`、`eval`。
//! Router / Agent Loop 在包外由 `core::start_turn` 消费。

mod cache;
pub mod commands;
mod eval;
mod finalize;
mod inject;
mod intent_result;
mod normalize;
mod repository;
mod rules;
mod score;
mod service;

pub use inject::format_for_prompt;
pub use intent_result::{Intent, IntentKind, IntentSource};
pub use service::ensure_seeded;

use anyhow::Result;

use crate::core::context::TurnContext;

/// 层入口：把推断结果写入 [`TurnContext`]。
pub async fn run(ctx: &mut TurnContext) -> Result<()> {
    ctx.intent = Some(infer(&ctx.content));
    Ok(())
}

/// 意图识别纯函数：规范化 → 规则打分 → 后处理。
pub fn infer(input: &str) -> Intent {
    let started = std::time::Instant::now();
    let norm = normalize::prepare(input);
    if norm.is_empty() {
        log::debug!(target: "chatcms_lib::core::intent", "intent empty input");
        return Intent::unknown();
    }

    let hit = score::evaluate(&norm);
    let is_high = hit.is_high;
    let intent = finalize::apply(hit, &norm);

    log::debug!(
        target: "chatcms_lib::core::intent",
        "intent kind={} conf={:.2} source={} needs_tools={} matched={} high={} ms={}",
        intent.kind.as_str(),
        intent.confidence,
        intent.source.as_str(),
        intent.needs_tools,
        intent.matched.len(),
        is_high,
        started.elapsed().as_millis(),
    );

    intent
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::score::HIGH_THRESHOLD;

    #[test]
    fn classifies_publish() {
        let i = infer("帮我发布到小红书");
        assert_eq!(i.kind, IntentKind::ContentPublish);
        assert!(i.confidence >= 0.35);
        assert!(i.needs_tools);
    }

    #[test]
    fn classifies_tools() {
        let i = infer("用 bash 列出当前目录");
        assert_eq!(i.kind, IntentKind::UseTools);
    }

    #[test]
    fn classifies_account() {
        let i = infer("查一下这个账号的登录密码");
        assert_eq!(i.kind, IntentKind::AccountLookup);
    }

    #[test]
    fn high_confidence_skips_needing_local() {
        let i = infer("发布到小红书并同步");
        assert_eq!(i.kind, IntentKind::ContentPublish);
        assert!(i.confidence >= HIGH_THRESHOLD);
    }
}
