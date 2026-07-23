//! 工具路由：按工具名分发到子 Agent、MCP 或内置实现。

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::tools;

use super::permission::request_permission;
use super::state::AgentState;
use super::subagent::run_sub_agent;

/// 主 Agent 工具分发：spawn_agent → MCP →（可选权限）→ 内置 tools。
pub async fn dispatch_tool(
    tc: &tools::ToolCall,
    app: &AppHandle,
    state: &State<'_, AgentState>,
    session_id: &str,
) -> tools::ToolResult {
    // 启动子 Agent，不进入本地工具执行
    if tc.name == "spawn_agent" {
        return dispatch_spawn_agent(tc, app, session_id).await;
    }

    // MCP 工具名形如 mcp__server__tool
    if state.mcp.lock().await.is_mcp_tool(&tc.name) {
        return dispatch_mcp_tool(tc, state).await;
    }

    // bash / write_file 等需前端确认
    if tools::requires_permission(&tc.name) {
        let allowed = request_permission(app, state, session_id, tc).await;
        if !allowed {
            return tools::ToolResult {
                id: tc.id.clone(),
                content: "User denied permission.".to_string(),
                is_error: true,
            };
        }
    }

    tools::execute(tc).await
}

/// 启动子 Agent：通知 UI → 跑独立 loop → 把最终文本当工具结果返回。
async fn dispatch_spawn_agent(
    tc: &tools::ToolCall,
    app: &AppHandle,
    session_id: &str,
) -> tools::ToolResult {
    let prompt = tc.input["prompt"].as_str().unwrap_or("").to_string();
    let sys = tc.input["system_prompt"].as_str().map(String::from);

    let _ = app.emit(
        "subagent-start",
        json!({ "parent_session_id": session_id, "task_id": &tc.id, "prompt": &prompt }),
    );

    let result_text = match run_sub_agent(app.clone(), sys, prompt).await {
        Ok(text) => text,
        Err(e) => format!("[sub-agent error] {e}"),
    };

    let _ = app.emit(
        "subagent-done",
        json!({ "parent_session_id": session_id, "task_id": &tc.id }),
    );

    tools::ToolResult {
        id: tc.id.clone(),
        content: result_text,
        is_error: false,
    }
}

/// 转发到已连接的 MCP 子进程。
async fn dispatch_mcp_tool(
    tc: &tools::ToolCall,
    state: &State<'_, AgentState>,
) -> tools::ToolResult {
    let mcp = state.mcp.lock().await;
    match mcp.call_tool(&tc.name, tc.input.clone()).await {
        Ok(text) => tools::ToolResult {
            id: tc.id.clone(),
            content: text,
            is_error: false,
        },
        Err(e) => tools::ToolResult {
            id: tc.id.clone(),
            content: e.to_string(),
            is_error: true,
        },
    }
}

/// 子 Agent 工具分发：仅 MCP + 内置工具（禁止再 spawn，不弹权限窗）。
pub async fn dispatch_sub_tool(
    tc: &tools::ToolCall,
    app: &AppHandle,
    mcp_tool_names: &[String],
) -> tools::ToolResult {
    if mcp_tool_names.iter().any(|n| n == &tc.name) {
        let s = app.state::<AgentState>();
        let mcp = s.mcp.lock().await;
        return match mcp.call_tool(&tc.name, tc.input.clone()).await {
            Ok(text) => tools::ToolResult {
                id: tc.id.clone(),
                content: text,
                is_error: false,
            },
            Err(e) => tools::ToolResult {
                id: tc.id.clone(),
                content: e.to_string(),
                is_error: true,
            },
        };
    }

    tools::execute(tc).await
}
