//! 富化：写入派生字段（needs_tools 等），不做兜底。

use super::fusion::FusedCandidate;
use super::intent_result::{Intent, IntentKind};

const NEEDS_TOOLS_MIN_CONFIDENCE: f32 = 0.45;

/// 由融合候选生成带派生字段的 Intent。
pub fn enrich(fused: FusedCandidate) -> Intent {
    let needs_tools = fused.needs_tools_hint.unwrap_or_else(|| {
        matches!(
            fused.kind,
            IntentKind::UseTools | IntentKind::ContentPublish | IntentKind::AccountLookup
        ) && fused.confidence >= NEEDS_TOOLS_MIN_CONFIDENCE
    });

    Intent {
        kind: fused.kind,
        confidence: fused.confidence,
        matched: fused.matched,
        source: fused.source,
        needs_tools,
    }
}
