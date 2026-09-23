//! Tool result 截断：防止大量输出撑爆 context window。

/// 最大允许保留的 tool result 字符数（约 8k tokens）
const MAX_CHARS: usize = 32_000;

/// 截断 tool result 内容。
/// 超过阈值时保留前 60% + 后 20%，中间替换为省略提示。
pub fn truncate_tool_result(content: &str) -> String {
    if content.len() <= MAX_CHARS {
        return content.to_string();
    }
    let head_len = (MAX_CHARS as f64 * 0.6) as usize;
    let tail_len = (MAX_CHARS as f64 * 0.2) as usize;
    let head = &content[..head_len];
    let tail = &content[content.len() - tail_len..];
    let omitted_chars = content.len() - head_len - tail_len;
    format!(
        "{head}\n\n[...已省略约 {omitted_chars} 字符的中间内容...]\n\n{tail}"
    )
}
