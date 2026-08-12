//! Agent 回合辅助：推送 UI 事件、工具展示文案、持久化会话快照。

use tauri::{AppHandle, Emitter, State};

use crate::tools;

/// 把工具调用格式化成会话里可读的 Tool 消息文本（前端 ToolMessage 可解析）。
pub fn tool_display(tc: &tools::ToolCall, result: &tools::ToolResult) -> String {
    let input = serde_json::to_string(&tc.input).unwrap_or_else(|_| "{}".into());
    let body = if result.is_error {
        format!("[error]\n{}", result.content)
    } else {
        result.content.clone()
    };
    format!("[tool: {} | {}]\n{}", tc.name, input, body)
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

/// 内存会话变更后写入 SQLite（仅保存指定会话）。
pub async fn save_sessions_snapshot(
    app: &AppHandle,
    state: &State<'_, super::state::AgentState>,
    sid: &str,
) {
    let session = state.sessions.lock().unwrap().get(sid).cloned();
    if let Some(s) = session {
        crate::persist::save_session(app, &s).await;
    }
}
