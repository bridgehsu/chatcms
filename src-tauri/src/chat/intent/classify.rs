//! Local Classifier：低置信时由本地小模型补判（预留）。
//! 本期始终返回 None，流水线跳过本地。

use super::intent_result::IntentKind;
use super::normalize::NormalizedInput;

/// 本地分类命中结果。
#[derive(Debug, Clone)]
pub struct LocalHit {
    pub kind: IntentKind,
    pub confidence: f32,
    /// 若本地直接给出是否需要工具，融合/enrich 可参考
    pub needs_tools: Option<bool>,
}

/// 尝试本地分类；未配置或失败时返回 None。
pub fn classify(_input: &NormalizedInput) -> Option<LocalHit> {
    None
}
