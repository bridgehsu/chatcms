use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::agents::tools::ToolCall;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamChunk {
    pub session_id: String,
    pub delta: String,
    pub done: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallEvent {
    pub session_id: String,
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolResultEvent {
    pub session_id: String,
    pub id: String,
    pub content: String,
    pub is_error: bool,
}

pub struct ProviderOutput {
    pub text: String,
    pub tool_calls: Vec<ToolCall>,
    /// 本次 API 调用消耗的 input tokens（0 = 未知）
    pub input_tokens: u32,
    /// 本次 API 调用消耗的 output tokens（0 = 未知）
    pub output_tokens: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct TokenUsageEvent {
    pub session_id: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
}
