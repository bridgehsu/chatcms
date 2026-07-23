//! Agent 回合辅助：组装 API content 块、推送 UI 事件、持久化会话快照。

use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::provider::ProviderOutput;
use crate::tools;

/// 组装助手回合 content：可选 text + 若干 tool_use。
pub fn assistant_content_blocks(output: &ProviderOutput) -> Vec<serde_json::Value> {
    let mut blocks = Vec::new();
    if !output.text.is_empty() {
        blocks.push(json!({"type": "text", "text": output.text}));
    }
    for tc in &output.tool_calls {
        blocks.push(json!({
            "type": "tool_use",
            "id": tc.id,
            "name": tc.name,
            "input": tc.input,
        }));
    }
    blocks
}

/// 组装单条 tool_result，供下一轮 user 消息使用。
pub fn tool_result_block(result: &tools::ToolResult) -> serde_json::Value {
    json!({
        "type": "tool_result",
        "tool_use_id": result.id,
        "content": result.content,
        "is_error": result.is_error,
    })
}

/// 把工具调用格式化成会话里可读的 Tool 消息文本。
pub fn tool_display(tc: &tools::ToolCall, result: &tools::ToolResult) -> String {
    format!(
        "[tool: {} | {}]\n{}",
        tc.name,
        serde_json::to_string(&tc.input).unwrap_or_default(),
        result.content
    )
}

/// 通知前端：开始调用某工具。
pub fn emit_tool_call(app: &AppHandle, session_id: &str, tc: &tools::ToolCall) {
    use crate::provider::ToolCallEvent;
    let _ = app.emit(
        "tool-call",
        ToolCallEvent {
            session_id: session_id.to_string(),
            id: tc.id.clone(),
            name: tc.name.clone(),
            input: tc.input.clone(),
        },
    );
}

/// 通知前端：工具执行结束。
pub fn emit_tool_result(app: &AppHandle, session_id: &str, result: &tools::ToolResult) {
    use crate::provider::ToolResultEvent;
    let _ = app.emit(
        "tool-result",
        ToolResultEvent {
            session_id: session_id.to_string(),
            id: result.id.clone(),
            content: result.content.clone(),
            is_error: result.is_error,
        },
    );
}

/// 内存会话变更后写入 persist。
pub fn save_sessions_snapshot(app: &AppHandle, state: &State<'_, super::state::AgentState>) {
    let snapshot = state.sessions.lock().unwrap().clone();
    crate::persist::save_sessions(app, &snapshot);
}
