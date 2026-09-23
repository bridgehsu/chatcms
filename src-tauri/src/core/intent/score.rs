//! 规则打分 + 置信评估：命中累加，选出赢家。

use super::cache;
use super::intent_result::IntentKind;
use super::normalize::NormalizedInput;

/// 规则路径高置信门槛（预留给未来第二通道；当前仅作可观测标记）。
pub const HIGH_THRESHOLD: f32 = 0.7;

/// 单个意图的原始得分。
#[derive(Debug, Clone)]
struct ScoredCandidate {
    kind: IntentKind,
    raw_score: f32,
    matched: Vec<String>,
}

/// 规则打分后的赢家（含置信度）。
#[derive(Debug, Clone)]
pub struct RulesHit {
    pub kind: IntentKind,
    pub confidence: f32,
    pub matched: Vec<String>,
    pub is_high: bool,
}

impl RulesHit {
    fn unknown() -> Self {
        Self {
            kind: IntentKind::Unknown,
            confidence: 0.0,
            matched: vec![],
            is_high: false,
        }
    }
}

/// 对规范化输入套启用中的规则，返回最高分意图。
pub fn evaluate(input: &NormalizedInput) -> RulesHit {
    let candidates: Vec<ScoredCandidate> = cache::enabled_rules()
        .into_iter()
        .map(|rule| {
            let mut raw_score = 0.0f32;
            let mut matched = Vec::new();
            for kw in &rule.keywords {
                let hit = if kw.is_ascii() {
                    input.lower.contains(kw.as_str())
                } else {
                    input.text.contains(kw.as_str())
                };
                if hit {
                    raw_score += rule.weight;
                    matched.push(kw.clone());
                }
            }
            ScoredCandidate {
                kind: rule.kind,
                raw_score,
                matched,
            }
        })
        .collect();

    pick_best(&candidates)
}

fn pick_best(candidates: &[ScoredCandidate]) -> RulesHit {
    let mut best = RulesHit::unknown();
    for c in candidates {
        let confidence = c.raw_score.clamp(0.0, 1.0);
        if confidence > best.confidence {
            best = RulesHit {
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
