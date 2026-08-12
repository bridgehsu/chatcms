//! 子 Agent：独立消息历史的短循环，结果回传给父 Agent 的 spawn_agent 工具。

use anyhow::Result;
use serde_json::json;
use tauri::{AppHandle, Manager};

use crate::provider;
use crate::tools;

use super::dispatch::dispatch_sub_tool;
use super::state::AgentState;

/// 跑隔离的子 Agent 循环（不落库会话、不弹权限确认）。
pub async fn run_sub_agent(
    app: AppHandle,
    system_prompt: Option<String>,
    prompt: String,
    workspace_dir: Option<String>,
) -> Result<String> {
    // 复用父进程里的配置与 MCP 工具列表
    let (config, mcp_api_tools) = {
        let s = app.state::<AgentState>();
        let config = s.config.lock().unwrap().clone();
        let mcp_tools = s.mcp.lock().await.all_api_tools();
        (config, mcp_tools)
    };

    let mcp_tool_names: Vec<String> = mcp_api_tools.iter().map(|t| t.name.clone()).collect();
    let mut api_messages = vec![json!({"role": "user", "content": prompt})];
    let mut final_text = String::new();
    let sub_id = format!("sub-{}", uuid::Uuid::new_v4());

    loop {
        // 去掉 spawn_agent，避免无限嵌套
        let mut sub_tools = tools::all_tools();
        sub_tools.retain(|t| t.name != "spawn_agent");
        sub_tools.extend(mcp_api_tools.clone());

        let output = provider::stream_chat(
            app.clone(),
            config.clone(),
            sub_id.clone(),
            api_messages.clone(),
            sub_tools,
            system_prompt.clone(),
        )
        .await?;

        // 无工具调用则本轮结束
        if output.tool_calls.is_empty() {
            final_text = output.text;
            break;
        }

        let mut results = Vec::new();
        for tc in &output.tool_calls {
            results.push(dispatch_sub_tool(tc, &app, &mcp_tool_names, workspace_dir.as_deref()).await);
        }
        api_messages.extend(provider::encode_tool_turn(
            config.provider.kind.clone(),
            &output,
            &results,
        ));
    }

    Ok(final_text)
}
