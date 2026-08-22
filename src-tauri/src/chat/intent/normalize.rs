//! 用户输入规范化：不做意图判定。

/// 规范化后的本轮输入。
#[derive(Debug, Clone)]
pub struct NormalizedInput {
    /// trim 后的原文（中文匹配用）
    pub text: String,
    /// 小写副本（ASCII 关键词匹配用）
    pub lower: String,
    pub char_count: usize,
}

impl NormalizedInput {
    pub fn is_empty(&self) -> bool {
        self.text.is_empty()
    }
}

pub fn normalize(input: &str) -> NormalizedInput {
    let text = input.trim().to_string();
    let lower = text.to_lowercase();
    let char_count = text.chars().count();
    NormalizedInput {
        text,
        lower,
        char_count,
    }
}
