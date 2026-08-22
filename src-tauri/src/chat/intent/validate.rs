//! 校验：边界修正，不做业务兜底。

use super::intent_result::{Intent, IntentKind};

/// 确保 confidence 合法；Unknown 不强制需要工具。
pub fn validate(mut intent: Intent) -> Intent {
    if !intent.confidence.is_finite() {
        intent.confidence = 0.0;
    }
    intent.confidence = intent.confidence.clamp(0.0, 1.0);

    if intent.kind == IntentKind::Unknown {
        intent.needs_tools = false;
    }

    intent
}
