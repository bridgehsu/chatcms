//! 后处理：富化 → 校验 → 兜底，产出最终 [`Intent`]。
//!
//! 当前仅规则路径；低置信第二通道（本地/LLM）以后再接。

use super::intent_result::{Intent, IntentKind, IntentSource};
use super::normalize::NormalizedInput;
use super::score::RulesHit;

const NEEDS_TOOLS_MIN_CONFIDENCE: f32 = 0.45;
const SHORT_CHAT_CHARS: usize = 40;
const SHORT_CHAT_CONFIDENCE: f32 = 0.3;

/// 由规则命中结果生成最终 Intent。
pub fn apply(hit: RulesHit, input: &NormalizedInput) -> Intent {
    let intent = enrich(hit);
    let intent = validate(intent);
    fallback(intent, input)
}

fn enrich(hit: RulesHit) -> Intent {
    let needs_tools = matches!(
        hit.kind,
        IntentKind::UseTools | IntentKind::ContentPublish | IntentKind::AccountLookup
    ) && hit.confidence >= NEEDS_TOOLS_MIN_CONFIDENCE;

    Intent {
        kind: hit.kind,
        confidence: hit.confidence,
        matched: hit.matched,
        source: IntentSource::Rules,
        needs_tools,
    }
}

fn validate(mut intent: Intent) -> Intent {
    if !intent.confidence.is_finite() {
        intent.confidence = 0.0;
    }
    intent.confidence = intent.confidence.clamp(0.0, 1.0);

    if intent.kind == IntentKind::Unknown {
        intent.needs_tools = false;
    }

    intent
}

fn fallback(mut intent: Intent, input: &NormalizedInput) -> Intent {
    if intent.kind == IntentKind::Unknown && input.char_count < SHORT_CHAT_CHARS {
        intent.kind = IntentKind::GeneralChat;
        intent.confidence = SHORT_CHAT_CONFIDENCE;
        intent.matched.clear();
        intent.needs_tools = false;
    }
    intent
}
