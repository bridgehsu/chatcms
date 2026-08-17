use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::tools::ToolCall;

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
}
