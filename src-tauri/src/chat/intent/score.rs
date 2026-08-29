//! 规则打分：命中累加，不管阈值与融合。

use super::cache;
use super::intent_result::IntentKind;
use super::normalize::NormalizedInput;

/// 单个意图的原始得分。
#[derive(Debug, Clone)]
pub struct ScoredCandidate {
    pub kind: IntentKind,
    pub raw_score: f32,
    pub matched: Vec<String>,
}

/// 对规范化输入套启用中的规则，返回各意图得分。
pub fn score_all(input: &NormalizedInput) -> Vec<ScoredCandidate> {
    cache::enabled_rules()
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
        .collect()
}
