//! 执行工具层：权限后的工具回合（实现委托 `agents::dispatch`）。

mod tool_turn;

pub use tool_turn::append_tool_turn;

/// 层入口（供 plan / agent_loop 调用）。
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
