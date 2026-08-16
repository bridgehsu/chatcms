//! 主会话入口：组装 messages / tools，跑 Agent Loop，直到模型不再调用工具。

use anyhow::Result;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::config::{AppConfig, ProviderKind};
use crate::kbase as knowledge;
use crate::memory::{Role, Session};
use crate::provider::{self, ProviderOutput};
use crate::scripts;
use crate::tools;

use super::dispatch::dispatch_tool;
use super::state::AgentState;
use super::turns::{emit_tool_call, emit_tool_result, save_sessions_snapshot, tool_display};

/// 主聊天入口：准备上下文 → Agent Loop → 返回 session_id。
pub async fn send_message(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    agent_id: Option<String>,
    content: String,
) -> Result<String> {
    let config = state.config.lock().unwrap().clone();
    let sid = ensure_session(&app, &state, session_id, agent_id.clone()).await;
    push_user_message(&app, &state, &sid, &content).await;

    // 优先用 session 绑定的 agent，否则按 agent_id 参数找，最后 fallback 到默认
    let resolved_agent_id = agent_id.or_else(|| {
        state.sessions.lock().unwrap().get(&sid).and_then(|s| s.agent_id.clone())
    });
    let active_agent = resolve_active_agent(&state, resolved_agent_id.as_deref());
    let workspace_dir = active_agent.as_ref().and_then(|a| a.workspace_dir.clone());
    let system_prompt = build_system_prompt(&state, &content, active_agent);
    let mut api_messages = build_api_messages(&state, &sid, &config);

    run_agent_loop(
        &app,
        &state,
        &config,
        &sid,
        &mut api_messages,
        system_prompt,
        workspace_dir.as_deref(),
    )
    .await?;

    Ok(sid)
}

// ── 准备阶段 ──────────────────────────────────────────────────────────────────

fn build_system_prompt(
    state: &State<'_, AgentState>,
    content: &str,
    active_agent: Option<crate::agents::AgentProfile>,
) -> Option<String> {
    let mut blocks: Vec<String> = Vec::new();

    if let Some(persona) = persona_block(active_agent.as_ref()) {
        blocks.push(persona);
    }
    if let Some(memory) = knowledge_block(state, content) {
        blocks.push(memory);
    }
    if let Some(skills) = skills_block(state, content, active_agent.as_ref()) {
        blocks.push(skills);
    }

    if blocks.is_empty() {
        None
    } else {
        Some(blocks.join("\n\n"))
    }
}

fn resolve_active_agent(state: &State<'_, AgentState>, agent_id: Option<&str>) -> Option<crate::agents::AgentProfile> {
    let active_id = state.config.lock().unwrap().active_agent_id.clone();
    let agents = state.agents.lock().unwrap();
    if let Some(id) = agent_id {
        if let Some(a) = agents.iter().find(|a| a.id == id && a.enabled) {
            return Some(a.clone());
        }
    }
    if let Some(id) = &active_id {
        if let Some(a) = agents.iter().find(|a| &a.id == id && a.enabled) {
            return Some(a.clone());
        }
    }
    agents.iter().find(|a| a.enabled).cloned()
}

fn persona_block(agent: Option<&crate::agents::AgentProfile>) -> Option<String> {
    agent.map(crate::agents::format_persona)
}

fn knowledge_block(state: &State<'_, AgentState>, content: &str) -> Option<String> {
    let entries = state.knowledge.lock().unwrap().clone();
    let relevant = knowledge::search(&entries, content, 3);
    let memory = knowledge::format_for_prompt(&relevant);
    if memory.is_empty() {
        None
    } else {
        Some(memory)
    }
}

fn skills_block(
    state: &State<'_, AgentState>,
    content: &str,
    active_agent: Option<&crate::agents::AgentProfile>,
) -> Option<String> {
    let skill_list = state.skills.lock().unwrap().clone();
    let allowlist = active_agent.and_then(|a| a.skills.as_ref().map(|v| v.as_slice()));
    let skill_prompt = scripts::format_for_prompt(&skill_list, content, allowlist);
    if skill_prompt.is_empty() {
        None
    } else {
        Some(skill_prompt)
    }
}

fn build_api_messages(state: &State<'_, AgentState>, sid: &str, config: &AppConfig) -> Vec<Value> {
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

async fn collect_tools(state: &State<'_, AgentState>) -> Vec<tools::ToolDef> {
    let mut t = tools::all_tools();
    t.extend(state.mcp.lock().await.all_api_tools());
    t
}

// ── Agent Loop ────────────────────────────────────────────────────────────────

async fn run_agent_loop(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    config: &AppConfig,
    sid: &str,
    api_messages: &mut Vec<Value>,
    system_prompt: Option<String>,
    workspace_dir: Option<&str>,
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

        if output.tool_calls.is_empty() {
            finalize_assistant_turn(app, state, sid, &output.text).await;
            break;
        }

        append_tool_turn(
            app,
            state,
            &config.provider.kind,
            sid,
            api_messages,
            &output,
            workspace_dir,
        )
        .await;
    }
    Ok(())
}

async fn finalize_assistant_turn(
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
    save_sessions_snapshot(app, state, sid).await;
}

async fn append_tool_turn(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    kind: &ProviderKind,
    sid: &str,
    api_messages: &mut Vec<Value>,
    output: &ProviderOutput,
    workspace_dir: Option<&str>,
) {
    let mut results: Vec<tools::ToolResult> = Vec::new();
    for tc in &output.tool_calls {
        results.push(execute_one_tool(app, state, sid, tc, workspace_dir).await);
    }
    api_messages.extend(provider::encode_tool_turn(kind.clone(), output, &results));
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

    {
        let display = tool_display(tc, &result);
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::Tool, &display);
        }
    }
    save_sessions_snapshot(app, state, sid).await;

    result
}

// ── 会话辅助 ──────────────────────────────────────────────────────────────────

async fn ensure_session(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    session_id: Option<String>,
    agent_id: Option<String>,
) -> String {
    let (sid, new_session) = {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(id) = session_id {
            if sessions.contains_key(&id) {
                return id;
            }
        }
        let s = match agent_id {
            Some(aid) => Session::new_with_agent("New Chat", aid),
            None => Session::new("New Chat"),
        };
        let sid = s.id.clone();
        let clone = s.clone();
        sessions.insert(sid.clone(), s);
        (sid, clone)
    };
    crate::persist::save_session(app, &new_session).await;
    sid
}

async fn push_user_message(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    content: &str,
) {
    {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::User, content);
        }
    }
    save_sessions_snapshot(app, state, sid).await;
}
