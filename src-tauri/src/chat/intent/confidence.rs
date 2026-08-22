//! 置信度：原始分 → clamp；选出赢家；判定 High / Low。

use super::intent_result::IntentKind;
use super::score::ScoredCandidate;

/// 规则路径置信度门槛：达到则跳过本地分类器。
pub const HIGH_THRESHOLD: f32 = 0.7;

/// 规则打分后的置信评估。
#[derive(Debug, Clone)]
pub struct RulesAssessment {
    pub kind: IntentKind,
    pub confidence: f32,
    pub matched: Vec<String>,
    pub is_high: bool,
}

impl RulesAssessment {
    pub fn unknown() -> Self {
        Self {
            kind: IntentKind::Unknown,
            confidence: 0.0,
            matched: vec![],
            is_high: false,
        }
    }
}

/// 从各意图得分中取最高，并标记是否高置信。
pub fn assess(candidates: &[ScoredCandidate]) -> RulesAssessment {
    let mut best = RulesAssessment::unknown();
    for c in candidates {
        let confidence = c.raw_score.clamp(0.0, 1.0);
        if confidence > best.confidence
            || (confidence == best.confidence
                && confidence > 0.0
                && matches!(best.kind, IntentKind::Unknown))
        {
            best = RulesAssessment {
                kind: c.kind,
                confidence,
                matched: c.matched.clone(),
                is_high: false,
            };
        }
    }
    best.is_high = best.confidence >= HIGH_THRESHOLD && best.kind != IntentKind::Unknown;
    best
}
