use std::collections::HashMap;
use std::sync::Mutex;

use anyhow::Result;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

use crate::channels::ChannelState;
use crate::config::{AppConfig, ProviderKind};
use crate::knowledge::{self, KnowledgeEntry};
use crate::mcp::McpManager;
use crate::memory::{Role, Session};
use crate::persist;
use crate::provider::{self, ToolCallEvent, ToolResultEvent};
use crate::tools;

// ── State ─────────────────────────────────────────────────────────────────────

pub struct AgentState {
    pub config: Mutex<AppConfig>,
    pub sessions: Mutex<HashMap<String, Session>>,
    pub pending_permissions: Mutex<HashMap<String, oneshot::Sender<bool>>>,
    pub mcp: tokio::sync::Mutex<McpManager>,
    pub knowledge: Mutex<Vec<KnowledgeEntry>>,
    pub channel: tokio::sync::Mutex<ChannelState>,
}

impl AgentState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            sessions: Mutex::new(HashMap::new()),
            pending_permissions: Mutex::new(HashMap::new()),
            mcp: tokio::sync::Mutex::new(McpManager::new(HashMap::new())),
            knowledge: Mutex::new(Vec::new()),
            channel: tokio::sync::Mutex::new(ChannelState::default()),
        }
    }
}

// ── Permission event ──────────────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
pub struct PermissionRequest {
    pub request_id: String,
    pub session_id: String,
    pub tool_name: String,
    pub input: Value,
}

// ── Main entry point ──────────────────────────────────────────────────────────

pub async fn send_message(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
) -> Result<String> {
    let config = state.config.lock().unwrap().clone();

    // ── Get or create session ─────────────────────────────────────────────────
    let sid = {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(id) = session_id {
            if sessions.contains_key(&id) {
                id
            } else {
                let s = Session::new("New Chat");
                let sid = s.id.clone();
                sessions.insert(sid.clone(), s);
                sid
            }
        } else {
            let s = Session::new("New Chat");
            let sid = s.id.clone();
            sessions.insert(sid.clone(), s);
            sid
        }
    };

    // ── Push user message ─────────────────────────────────────────────────────
    {
        let snapshot = {
            let mut sessions = state.sessions.lock().unwrap();
            if let Some(session) = sessions.get_mut(&sid) {
                session.push(Role::User, &content);
            }
            sessions.clone()
        };
        persist::save_sessions(&app, &snapshot);
    }

    // ── Build system prompt with relevant knowledge ───────────────────────────
    let system_prompt = {
        let entries = state.knowledge.lock().unwrap().clone();
        let relevant = knowledge::search(&entries, &content, 3);
        knowledge::format_for_prompt(&relevant)
    };

    // ── Build initial API messages ────────────────────────────────────────────
    let mut api_messages: Vec<Value> = {
        let sessions = state.sessions.lock().unwrap();
        let msgs = sessions.get(&sid).map(|s| s.messages.as_slice()).unwrap_or(&[]);
        match config.provider.kind {
            ProviderKind::Anthropic => provider::messages_to_anthropic(msgs),
            ProviderKind::OpenAI => provider::messages_to_openai(msgs),
        }
    };

    // ── Agent loop ────────────────────────────────────────────────────────────
    let sys = if system_prompt.is_empty() {
        None
    } else {
        Some(system_prompt)
    };

    loop {
        let all_tools: Vec<tools::ToolDef> = {
            let mut t = tools::all_tools();
            t.extend(state.mcp.lock().await.all_api_tools());
            t
        };

        let output = provider::stream_chat(
            app.clone(),
            config.clone(),
            sid.clone(),
            api_messages.clone(),
            all_tools,
            sys.clone(),
        )
        .await?;

        if output.tool_calls.is_empty() {
            if !output.text.is_empty() {
                let snapshot = {
                    let mut sessions = state.sessions.lock().unwrap();
                    if let Some(session) = sessions.get_mut(&sid) {
                        session.push(Role::Assistant, &output.text);
                        if session.title == "New Chat" {
                            session.title = output.text.chars().take(30).collect();
                        }
                    }
                    sessions.clone()
                };
                persist::save_sessions(&app, &snapshot);
            }
            break;
        }

        // Build assistant turn with tool_use blocks
        let assistant_content: Vec<Value> = {
            let mut blocks = Vec::new();
            if !output.text.is_empty() {
                blocks.push(json!({"type": "text", "text": output.text}));
            }
            for tc in &output.tool_calls {
                blocks.push(json!({"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input}));
            }
            blocks
        };
        api_messages.push(json!({"role": "assistant", "content": assistant_content}));

        let mut result_blocks: Vec<Value> = Vec::new();

        for tc in &output.tool_calls {
            let _ = app.emit(
                "tool-call",
                ToolCallEvent {
                    session_id: sid.clone(),
                    id: tc.id.clone(),
                    name: tc.name.clone(),
                    input: tc.input.clone(),
                },
            );

            let result = dispatch_tool(tc, &app, &state, &sid).await;

            let _ = app.emit(
                "tool-result",
                ToolResultEvent {
                    session_id: sid.clone(),
                    id: result.id.clone(),
                    content: result.content.clone(),
                    is_error: result.is_error,
                },
            );

            {
                let display = format!(
                    "[tool: {} | {}]\n{}",
                    tc.name,
                    serde_json::to_string(&tc.input).unwrap_or_default(),
                    result.content
                );
                let snapshot = {
                    let mut sessions = state.sessions.lock().unwrap();
                    if let Some(session) = sessions.get_mut(&sid) {
                        session.push(Role::Tool, &display);
                    }
                    sessions.clone()
                };
                persist::save_sessions(&app, &snapshot);
            }

            result_blocks.push(json!({
                "type": "tool_result",
                "tool_use_id": result.id,
                "content": result.content,
                "is_error": result.is_error,
            }));
        }

        api_messages.push(json!({"role": "user", "content": result_blocks}));
    }

    Ok(sid)
}

// ── Tool dispatch (handles spawn_agent + MCP + built-ins) ─────────────────────

async fn dispatch_tool(
    tc: &tools::ToolCall,
    app: &AppHandle,
    state: &State<'_, AgentState>,
    session_id: &str,
) -> tools::ToolResult {
    // ── spawn_agent ───────────────────────────────────────────────────────────
    if tc.name == "spawn_agent" {
        let prompt = tc.input["prompt"].as_str().unwrap_or("").to_string();
        let sys = tc.input["system_prompt"].as_str().map(String::from);

        // Notify UI that a sub-agent is starting
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

        return tools::ToolResult {
            id: tc.id.clone(),
            content: result_text,
            is_error: false,
        };
    }

    // ── MCP tool ──────────────────────────────────────────────────────────────
    if state.mcp.lock().await.is_mcp_tool(&tc.name) {
        let mcp = state.mcp.lock().await;
        return match mcp.call_tool(&tc.name, tc.input.clone()).await {
            Ok(text) => tools::ToolResult { id: tc.id.clone(), content: text, is_error: false },
            Err(e) => tools::ToolResult { id: tc.id.clone(), content: e.to_string(), is_error: true },
        };
    }

    // ── Built-in tool with permission ─────────────────────────────────────────
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

// ── Sub-agent loop (no persistence, no permission prompts) ────────────────────

pub async fn run_sub_agent(
    app: AppHandle,
    system_prompt: Option<String>,
    prompt: String,
) -> Result<String> {
    let (config, mcp_api_tools) = {
        let s = app.state::<AgentState>();
        let config = s.config.lock().unwrap().clone();
        let mcp_tools = s.mcp.lock().await.all_api_tools();
        (config, mcp_tools)
    };

    let mut api_messages = vec![json!({"role": "user", "content": prompt})];
    let mut final_text = String::new();
    let sub_id = format!("sub-{}", uuid::Uuid::new_v4());

    loop {
        // Sub-agent cannot spawn further agents (prevent unbounded recursion)
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

        if output.tool_calls.is_empty() {
            final_text = output.text;
            break;
        }

        let assistant_content: Vec<Value> = {
            let mut blocks = Vec::new();
            if !output.text.is_empty() {
                blocks.push(json!({"type": "text", "text": output.text}));
            }
            for tc in &output.tool_calls {
                blocks.push(json!({"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input}));
            }
            blocks
        };
        api_messages.push(json!({"role": "assistant", "content": assistant_content}));

        let mut result_blocks: Vec<Value> = Vec::new();
        for tc in &output.tool_calls {
            let result = if mcp_api_tools.iter().any(|t| t.name == tc.name) {
                let s = app.state::<AgentState>();
                let mcp = s.mcp.lock().await;
                match mcp.call_tool(&tc.name, tc.input.clone()).await {
                    Ok(text) => tools::ToolResult { id: tc.id.clone(), content: text, is_error: false },
                    Err(e) => tools::ToolResult { id: tc.id.clone(), content: e.to_string(), is_error: true },
                }
            } else {
                tools::execute(tc).await
            };

            result_blocks.push(json!({
                "type": "tool_result",
                "tool_use_id": result.id,
                "content": result.content,
                "is_error": result.is_error,
            }));
        }
        api_messages.push(json!({"role": "user", "content": result_blocks}));
    }

    Ok(final_text)
}

// ── Permission helper ─────────────────────────────────────────────────────────

async fn request_permission(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    session_id: &str,
    tc: &tools::ToolCall,
) -> bool {
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel::<bool>();
    {
        let mut pending = state.pending_permissions.lock().unwrap();
        pending.insert(request_id.clone(), tx);
    }

    let _ = app.emit(
        "permission-request",
        PermissionRequest {
            request_id,
            session_id: session_id.to_string(),
            tool_name: tc.name.clone(),
            input: tc.input.clone(),
        },
    );

    match tokio::time::timeout(std::time::Duration::from_secs(60), rx).await {
        Ok(Ok(allowed)) => allowed,
        _ => false,
    }
}

pub fn resolve_permission(state: &State<'_, AgentState>, request_id: &str, allowed: bool) {
    let mut pending = state.pending_permissions.lock().unwrap();
    if let Some(tx) = pending.remove(request_id) {
        let _ = tx.send(allowed);
    }
}
