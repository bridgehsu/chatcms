//! 会话意图识别流水线（软路由，不短路 Agent Loop）。
//!
//! ```text
//! Normalize → Rules/Score → Confidence → Local Classifier? → Fusion
//!   → Enrich → Validate → Fallback → Intent
//! ```
//!
//! Router / Agent Loop 在包外由 `service` 消费。
//! 入口：[`run`]。
//!
//! 规则数据可经 `intent_rule_*` 命令配置；热路径从 [`cache`] 同步读取。

mod cache;
mod classify;
pub mod commands;
mod confidence;
mod enrich;
mod eval;
mod fallback;
mod fusion;
mod inject;
mod intent_result;
mod normalize;
mod repository;
mod rules;
mod score;
mod service;
mod validate;

pub use inject::format_for_prompt;
pub use intent_result::{Intent, IntentKind, IntentSource};
pub use service::ensure_seeded;

/// 意图识别入口：串联全流水线，返回最终 [`Intent`]。
pub fn run(input: &str) -> Intent {
    let started = std::time::Instant::now();
    let norm = normalize::prepare(input);
    if norm.is_empty() {
        log::debug!(target: "chatcms_lib::chat::intent", "intent empty input");
        return Intent::unknown();
    }

    let scored = score::evaluate(&norm);
    let assessment = confidence::assess(&scored);

    let local_hit = if assessment.is_high {
        None
    } else {
        classify::classify(&norm)
    };

    let fused = fusion::fuse(&assessment, local_hit);
    let enriched = enrich::enrich(fused);
    let validated = validate::validate(enriched);
    let intent = fallback::apply(validated, &norm);

    log::debug!(
        target: "chatcms_lib::chat::intent",
        "intent kind={} conf={:.2} source={} needs_tools={} matched={} high={} ms={}",
        intent.kind.as_str(),
        intent.confidence,
        intent.source.as_str(),
        intent.needs_tools,
        intent.matched.len(),
        assessment.is_high,
        started.elapsed().as_millis(),
    );

    intent
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn classifies_publish() {
        let i = run("帮我发布到小红书");
        assert_eq!(i.kind, IntentKind::ContentPublish);
        assert!(i.confidence >= 0.35);
        assert!(i.needs_tools);
    }

    #[test]
    fn classifies_tools() {
        let i = run("用 bash 列出当前目录");
        assert_eq!(i.kind, IntentKind::UseTools);
    }

    #[test]
    fn classifies_account() {
        let i = run("查一下这个账号的登录密码");
        assert_eq!(i.kind, IntentKind::AccountLookup);
    }

    #[test]
    fn high_confidence_skips_needing_local() {
        let i = run("发布到小红书并同步");
        assert_eq!(i.kind, IntentKind::ContentPublish);
        assert!(i.confidence >= confidence::HIGH_THRESHOLD);
    }
}
