//! 工具回合：顺序执行 tool call，截断结果并写回会话。

use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use crate::agents::dispatch::dispatch_tool;
use crate::core::tools;
use crate::agents::AgentState;
use crate::core::memory;
use crate::core::memory::save_snapshot;
use crate::chat::Role;
use crate::common::provider::{self, ProviderOutput};

pub async fn append_tool_turn(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    kind: &str,
    sid: &str,
    api_messages: &mut Vec<Value>,
    output: &ProviderOutput,
    workspace_dir: Option<&str>,
) {
    let mut results: Vec<tools::ToolResult> = Vec::new();
    for tc in &output.tool_calls {
        results.push(execute_one_tool(app, state, sid, tc, workspace_dir).await);
    }
    api_messages.extend(provider::encode_tool_turn(kind, output, &results));
}

async fn execute_one_tool(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    tc: &tools::ToolCall,
    workspace_dir: Option<&str>,
) -> tools::ToolResult {
    emit_tool_call(app, sid, tc);
    let result = dispatch_tool(tc, app, state, sid, workspace_dir).await;
    emit_tool_result(app, sid, &result);
    let result = tools::ToolResult {
        content: memory::truncate_tool_result(&result.content),
        ..result
    };
    {
        let display = tool_display(tc, &result);
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::Tool, &display);
        }
    }
    save_snapshot(app, &**state, sid).await;
    result
}

fn tool_display(tc: &tools::ToolCall, result: &tools::ToolResult) -> String {
    let input = serde_json::to_string(&tc.input).unwrap_or_else(|_| "{}".into());
    let body = if result.is_error {
        format!("[error]\n{}", result.content)
    } else {
        result.content.clone()
    };
    format!("[tool: {} | {}]\n{}", tc.name, input, body)
}

fn emit_tool_call(app: &AppHandle, session_id: &str, tc: &tools::ToolCall) {
    use crate::common::provider::ToolCallEvent;
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

fn emit_tool_result(app: &AppHandle, session_id: &str, result: &tools::ToolResult) {
    use crate::common::provider::ToolResultEvent;
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
