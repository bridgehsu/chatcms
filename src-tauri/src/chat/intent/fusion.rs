//! 融合：合并规则评估与本地补判。

use super::confidence::RulesAssessment;
use super::intent_result::{IntentKind, IntentSource};
use super::classify::LocalHit;

/// 融合后的候选（尚未 enrich / validate / fallback）。
#[derive(Debug, Clone)]
pub struct FusedCandidate {
    pub kind: IntentKind,
    pub confidence: f32,
    pub matched: Vec<String>,
    pub source: IntentSource,
    /// 本地若给出 needs_tools 提示则带上
    pub needs_tools_hint: Option<bool>,
}

/// 高置信仅用规则；有本地结果时按置信度择优或标记 fused。
pub fn fuse(rules: &RulesAssessment, local: Option<LocalHit>) -> FusedCandidate {
    match local {
        None => FusedCandidate {
            kind: rules.kind,
            confidence: rules.confidence,
            matched: rules.matched.clone(),
            source: IntentSource::Rules,
            needs_tools_hint: None,
        },
        Some(hit) => {
            if hit.confidence > rules.confidence {
                FusedCandidate {
                    kind: hit.kind,
                    confidence: hit.confidence,
                    matched: rules.matched.clone(),
                    source: IntentSource::LocalLlm,
                    needs_tools_hint: hit.needs_tools,
                }
            } else if hit.confidence == rules.confidence && hit.kind != rules.kind {
                FusedCandidate {
                    kind: rules.kind,
                    confidence: rules.confidence,
                    matched: rules.matched.clone(),
                    source: IntentSource::Fused,
                    needs_tools_hint: hit.needs_tools,
                }
            } else {
                FusedCandidate {
                    kind: rules.kind,
                    confidence: rules.confidence,
                    matched: rules.matched.clone(),
                    source: IntentSource::Rules,
                    needs_tools_hint: hit.needs_tools,
                }
            }
        }
    }
}
