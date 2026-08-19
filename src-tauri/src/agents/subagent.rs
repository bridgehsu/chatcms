//! 子 Agent：独立消息历史的短循环，结果回传给父 Agent 的 spawn_agent 工具。

use anyhow::{bail, Result};
use serde_json::json;
use tauri::{AppHandle, Manager};

use crate::provider;
use super::tools;

use super::dispatch::dispatch_sub_tool;
use super::state::AgentState;

/// 跑隔离的子 Agent 循环（不落库会话、不弹权限确认）。
///
/// - `parent_workspace`：父 Agent 的 workspace（子 Agent workspace 不得超出此范围）
/// - `workspace_dir`：子 Agent 请求的 workspace（会被 clamp 到 parent_workspace 内）
pub async fn run_sub_agent(
    app: AppHandle,
    system_prompt: Option<String>,
    prompt: String,
    parent_workspace: Option<String>,
    workspace_dir: Option<String>,
) -> Result<String> {
    // workspace clamp：子 Agent workspace 必须在父 workspace 范围内
    let effective_workspace = clamp_workspace(parent_workspace.as_deref(), workspace_dir.as_deref());

    // 子 Agent 始终有 tools → 强制 cloud tier
    let has_tools = true;
    let profiles = crate::models::repository::list(&app).await;
    let router = {
        let s = app.state::<AgentState>();
        s.router.clone()
    };

    let mcp_api_tools = {
        let s = app.state::<AgentState>();
        let tools = s.mcp.lock().await.all_api_tools();
        tools
    };

    let mcp_tool_names: Vec<String> = mcp_api_tools.iter().map(|t| t.name.clone()).collect();
    let mut api_messages = vec![json!({"role": "user", "content": prompt})];
    let final_text: String;
    let sub_id = format!("sub-{}", uuid::Uuid::new_v4());

    const MAX_SUB_AGENT_ITERS: usize = 30;
    let mut iter_count = 0usize;

    loop {
        iter_count += 1;
        if iter_count > MAX_SUB_AGENT_ITERS {
            bail!("子 Agent 超过最大迭代次数 ({MAX_SUB_AGENT_ITERS})，已终止");
        }
        // 每轮独立选 profile（cloud tier，按权重轮询）
        let profile_id = router.pick(&profiles, has_tools, 0);
        let profile = match profile_id.and_then(|id| profiles.iter().find(|p| p.id == id).cloned()) {
            Some(p) => p,
            None => bail!("子 Agent 无可用的 Cloud 模型配置"),
        };

        let mut sub_tools = tools::all_tools();
        sub_tools.retain(|t| t.name != "spawn_agent");
        sub_tools.extend(mcp_api_tools.clone());

        let result = provider::stream_chat(
            app.clone(),
            &profile,
            sub_id.clone(),
            api_messages.clone(),
            sub_tools,
            system_prompt.clone(),
        )
        .await;

        let output = match result {
            Ok(o) => {
                router.mark_success(&profile.id);
                o
            }
            Err(e) => {
                router.mark_failed(&profile.id);
                return Err(e);
            }
        };

        if output.tool_calls.is_empty() {
            final_text = output.text;
            break;
        }

        let mut results = Vec::new();
        for tc in &output.tool_calls {
            results.push(
                dispatch_sub_tool(tc, &app, &mcp_tool_names, effective_workspace.as_deref()).await,
            );
        }
        api_messages.extend(provider::encode_tool_turn(
            &profile.kind,
            &output,
            &results,
        ));
    }

    Ok(final_text)
}

/// 将 requested_workspace clamp 到 parent_workspace 范围内。
/// - 若 parent 为 None（全局权限），直接返回 requested
/// - 若 requested 为 None，返回 parent
/// - 若 requested 在 parent 路径之外，强制返回 parent
fn clamp_workspace(parent: Option<&str>, requested: Option<&str>) -> Option<String> {
    match (parent, requested) {
        (None, req) => req.map(|s| s.to_string()),
        (Some(p), None) => Some(p.to_string()),
        (Some(p), Some(r)) => {
            // 规范化路径后判断是否为子路径
            let parent_path = std::path::Path::new(p);
            let req_path = std::path::Path::new(r);
            if req_path.starts_with(parent_path) {
                Some(r.to_string())
            } else {
                // 超出父范围，clamp 回父路径
                Some(p.to_string())
            }
        }
    }
}
