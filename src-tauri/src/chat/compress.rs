//! 历史消息滚动压缩：当 context 过长时，压缩最旧的一批消息。

use super::{Message, Role};

/// context token 数超过此阈值时触发压缩（粗略估算：1 token ≈ 4 字符）
const COMPRESS_THRESHOLD_CHARS: usize = 240_000; // ≈ 60k tokens
/// 每次压缩保留最近 N 条消息不动
const KEEP_RECENT: usize = 20;

/// 估算消息列表的总字符数（粗略 token 估算）
pub fn estimate_chars(messages: &[Message]) -> usize {
    messages.iter().map(|m| m.content.len()).sum()
}

/// 检查是否需要压缩
pub fn needs_compress(messages: &[Message]) -> bool {
    estimate_chars(messages) > COMPRESS_THRESHOLD_CHARS
}

/// 将历史消息压缩为一条 system 摘要消息（调用方负责实际摘要，这里只做结构处理）。
/// 返回：(需要摘要的内容, 保留的尾部消息)
pub fn prepare_compress(messages: &[Message]) -> (String, Vec<Message>) {
    if messages.len() <= KEEP_RECENT {
        return (String::new(), messages.to_vec());
    }
    let split = messages.len() - KEEP_RECENT;
    let to_compress = &messages[..split];
    let keep = messages[split..].to_vec();

    let summary_input = to_compress
        .iter()
        .map(|m| {
            let role = match m.role {
                Role::User => "User",
                Role::Assistant => "Assistant",
                Role::System => "System",
                Role::Tool => "Tool",
            };
            format!("[{role}]: {}", m.content)
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    (summary_input, keep)
}

/// 将摘要文本 + 保留消息重组为新的消息列表
pub fn apply_compress(summary: String, keep: Vec<Message>) -> Vec<Message> {
    use uuid::Uuid;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let summary_msg = Message {
        id: Uuid::new_v4().to_string(),
        role: Role::System,
        content: format!("[历史摘要]\n{summary}"),
        created: now,
    };

    let mut result = vec![summary_msg];
    result.extend(keep);
    result
}
