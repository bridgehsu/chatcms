//! 工具执行（嵌在 plan 的 Agent Loop 内，不是 turn 顶层同级层）。
//!
//! 权限与路由委托 `agents::dispatch`；本模块只组装 tool 回合写回会话。

mod tool_turn;

pub use tool_turn::append_tool_turn;

/// 供 `plan::agent_loop` 在模型返回 tool_calls 时调用。
pub async fn run(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, crate::agents::AgentState>,
    kind: &str,
    sid: &str,
    api_messages: &mut Vec<serde_json::Value>,
    output: &crate::common::provider::ProviderOutput,
    workspace_dir: Option<&str>,
) {
    append_tool_turn(app, state, kind, sid, api_messages, output, workspace_dir).await;
}
