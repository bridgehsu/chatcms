//! 兜底：短句 Unknown → general_chat 等业务默认。

use super::intent_result::{Intent, IntentKind};
use super::normalize::NormalizedInput;

const SHORT_CHAT_CHARS: usize = 40;
const SHORT_CHAT_CONFIDENCE: f32 = 0.3;

/// 应用兜底策略。
pub fn apply(mut intent: Intent, input: &NormalizedInput) -> Intent {
    if intent.kind == IntentKind::Unknown && input.char_count < SHORT_CHAT_CHARS {
        intent.kind = IntentKind::GeneralChat;
        intent.confidence = SHORT_CHAT_CONFIDENCE;
        intent.matched.clear();
        intent.needs_tools = false;
    }
    intent
}
