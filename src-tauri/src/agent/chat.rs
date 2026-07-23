//! 主会话入口：组装 messages / tools，跑 Agent Loop，直到模型不再调用工具。

use anyhow::Result;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::config::{AppConfig, ProviderKind};
use crate::knowledge;
use crate::memory::{Role, Session};
use crate::provider::{self, ProviderOutput};
use crate::tools;

use super::dispatch::dispatch_tool;
use super::state::AgentState;
use super::turns::{
    assistant_content_blocks, emit_tool_call, emit_tool_result, save_sessions_snapshot,
    tool_display, tool_result_block,
};

/// 主聊天入口：准备上下文 → Agent Loop → 返回 session_id。
pub async fn send_message(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
) -> Result<String> {
    let config = state.config.lock().unwrap().clone();
    let sid = ensure_session(&state, session_id);
    push_user_message(&app, &state, &sid, &content);

    let system_prompt = build_system_prompt(&state, &content);
    let mut api_messages = build_api_messages(&state, &sid, &config);

    run_agent_loop(&app, &state, &config, &sid, &mut api_messages, system_prompt).await?;

    Ok(sid)
}

// ── 准备阶段 ──────────────────────────────────────────────────────────────────

/// 按用户输入检索知识库，拼成 system prompt（无命中则 None）。
fn build_system_prompt(state: &State<'_, AgentState>, content: &str) -> Option<String> {
    let entries = state.knowledge.lock().unwrap().clone();
    let relevant = knowledge::search(&entries, content, 3);
    let prompt = knowledge::format_for_prompt(&relevant);
    if prompt.is_empty() {
        None
    } else {
        Some(prompt)
    }
}

/// 把内存会话历史转成当前 Provider 的 API messages。
fn build_api_messages(
    state: &State<'_, AgentState>,
    sid: &str,
    config: &AppConfig,
) -> Vec<Value> {
    let sessions = state.sessions.lock().unwrap();
    let msgs = sessions
        .get(sid)
        .map(|s| s.messages.as_slice())
        .unwrap_or(&[]);
    match config.provider.kind {
        ProviderKind::Anthropic => provider::messages_to_anthropic(msgs),
        ProviderKind::OpenAI => provider::messages_to_openai(msgs),
    }
}

/// 收集本轮可用工具：内置 + 已连接 MCP。
async fn collect_tools(state: &State<'_, AgentState>) -> Vec<tools::ToolDef> {
    let mut t = tools::all_tools();
    t.extend(state.mcp.lock().await.all_api_tools());
    t
}

// ── Agent Loop ────────────────────────────────────────────────────────────────

/// 请求 LLM → 有 tool 则执行并回灌 → 再请求，直到纯文本结束。
async fn run_agent_loop(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    config: &AppConfig,
    sid: &str,
    api_messages: &mut Vec<Value>,
    system_prompt: Option<String>,
) -> Result<()> {
    loop {
        let all_tools = collect_tools(state).await;

        let output = provider::stream_chat(
            app.clone(),
            config.clone(),
            sid.to_string(),
            api_messages.clone(),
            all_tools,
            system_prompt.clone(),
        )
        .await?;

        // 无工具调用：落盘最终回复并退出
        if output.tool_calls.is_empty() {
            finalize_assistant_turn(app, state, sid, &output.text);
            break;
        }

        // 有工具：执行并把结果回灌进 api_messages，继续下一圈
        append_tool_turn(app, state, sid, api_messages, &output).await;
    }
    Ok(())
}

/// 模型本轮只回文字：写入会话并持久化（可顺带自动命名标题）。
fn finalize_assistant_turn(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    text: &str,
) {
    if text.is_empty() {
        return;
    }
    {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::Assistant, text);
            if session.title == "New Chat" {
                session.title = text.chars().take(30).collect();
            }
        }
    }
    save_sessions_snapshot(app, state);
}

/// 把 assistant(tool_use) + 各工具执行结果 追加进 api_messages，并同步 UI / 会话。
async fn append_tool_turn(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    api_messages: &mut Vec<Value>,
    output: &ProviderOutput,
) {
    api_messages.push(json!({
        "role": "assistant",
        "content": assistant_content_blocks(output),
    }));

    let mut result_blocks: Vec<Value> = Vec::new();
    for tc in &output.tool_calls {
        let result = execute_one_tool(app, state, sid, tc).await;
        result_blocks.push(tool_result_block(&result));
    }

    api_messages.push(json!({"role": "user", "content": result_blocks}));
}

/// 执行单个工具：通知前端 → dispatch → 写入 Tool 消息 → 落盘。
async fn execute_one_tool(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    tc: &tools::ToolCall,
) -> tools::ToolResult {
    emit_tool_call(app, sid, tc);
    let result = dispatch_tool(tc, app, state, sid).await;
    emit_tool_result(app, sid, &result);

    {
        let display = tool_display(tc, &result);
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::Tool, &display);
        }
    }
    save_sessions_snapshot(app, state);

    result
}

// ── 会话辅助 ──────────────────────────────────────────────────────────────────

/// 复用已有会话，或新建一个空会话。
fn ensure_session(state: &State<'_, AgentState>, session_id: Option<String>) -> String {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(id) = session_id {
        if sessions.contains_key(&id) {
            return id;
        }
    }
    let s = Session::new("New Chat");
    let sid = s.id.clone();
    sessions.insert(sid.clone(), s);
    sid
}

/// 写入用户消息并持久化。
fn push_user_message(app: &AppHandle, state: &State<'_, AgentState>, sid: &str, content: &str) {
    {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::User, content);
        }
    }
    save_sessions_snapshot(app, state);
}
