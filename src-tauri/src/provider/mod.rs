use anyhow::{bail, Result};
use serde_json::Value;

use crate::config::{AppConfig, ProviderKind};
use crate::tools::{ToolDef, ToolResult};

mod types;
mod anthropic;
mod openai;

pub use types::{ProviderOutput, StreamChunk, ToolCallEvent, ToolResultEvent};
pub use anthropic::messages_to_anthropic;
pub use openai::messages_to_openai;

// ── Public entry point ────────────────────────────────────────────────────────

pub async fn stream_chat(
    app: tauri::AppHandle,
    config: AppConfig,
    session_id: String,
    api_messages: Vec<Value>,
    tools: Vec<ToolDef>,
    system_prompt: Option<String>,
) -> Result<ProviderOutput> {
    if config.provider.api_key.trim().is_empty() {
        bail!("API Key 未配置，请先点击右上角 ⚙ Settings 填写后重试");
    }
    match config.provider.kind {
        ProviderKind::Anthropic => {
            anthropic::stream_anthropic(app, config, session_id, api_messages, tools, system_prompt)
                .await
        }
        ProviderKind::OpenAI => {
            openai::stream_openai(app, config, session_id, api_messages, tools, system_prompt)
                .await
        }
    }
}

/// 将「助手工具调用 + 工具结果」编码为当前协议的 API messages。
pub fn encode_tool_turn(
    kind: ProviderKind,
    output: &ProviderOutput,
    results: &[ToolResult],
) -> Vec<Value> {
    match kind {
        ProviderKind::Anthropic => anthropic::encode_tool_turn_anthropic(output, results),
        ProviderKind::OpenAI => openai::encode_tool_turn_openai(output, results),
    }
}
