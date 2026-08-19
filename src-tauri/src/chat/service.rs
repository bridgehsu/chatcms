use anyhow::Result;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::watch;

use super::{now_secs, repository as repo, Role, Session};
use crate::agents::dispatch::dispatch_tool;
use crate::agents::AgentState;
use crate::chat::compress;
use crate::kbase as knowledge;
use crate::provider::{self, ProviderOutput};
use crate::scripts;
use crate::agents::tools;

// ── 会话 CRUD ─────────────────────────────────────────────────────────────────

/// 确保会话存在，不存在则新建（锁定当前 agent 的 workspace）并持久化。
pub async fn ensure_session(
    app: &AppHandle,
    state: &AgentState,
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
        let active_agent_id = state.config.lock().unwrap().active_agent_id.clone();
        let workspace_dir = {
            let agents = state.agents.lock().unwrap();
            agents.iter()
                .find(|a| agent_id.as_deref().map_or(false, |id| a.id == id) && a.enabled)
                .or_else(|| {
                    agents.iter().find(|a| {
                        active_agent_id.as_deref().map_or(false, |id| a.id == id) && a.enabled
                    })
                })
                .or_else(|| agents.iter().find(|a| a.enabled))
                .and_then(|a| a.workspace_dir.clone())
        };
        let s = match agent_id {
            Some(aid) => Session::new_with_agent("New Chat", aid, workspace_dir),
            None => {
                let mut s = Session::new("New Chat");
                s.workspace_dir = workspace_dir;
                s
            }
        };
        let sid = s.id.clone();
        let clone = s.clone();
        sessions.insert(sid.clone(), s);
        (sid, clone)
    };
    repo::save(app, &new_session).await;
    sid
}

/// 向会话追加用户消息并持久化。
pub async fn push_user_message(app: &AppHandle, state: &AgentState, sid: &str, content: &str) {
    {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(sid) {
            session.push(Role::User, content);
        }
    }
    save_snapshot(app, state, sid).await;
}

/// 将内存中的会话快照写入 SQLite。
pub async fn save_snapshot(app: &AppHandle, state: &AgentState, sid: &str) {
    let session = state.sessions.lock().unwrap().get(sid).cloned();
    if let Some(s) = session {
        repo::save(app, &s).await;
    }
}

/// 列出会话（按置顶 → 最近更新排序），返回摘要 JSON。
pub fn list(state: &AgentState, agent_id: Option<String>) -> Vec<serde_json::Value> {
    let sessions = state.sessions.lock().unwrap();
    let mut list: Vec<Session> = sessions
        .values()
        .filter(|s| match &agent_id {
            Some(id) => s.agent_id.as_deref() == Some(id.as_str()),
            None => true,
        })
        .cloned()
        .collect();
    list.sort_by(|a, b| match (a.pinned, b.pinned) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.updated.cmp(&a.updated),
    });
    list.iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id,
                "title": s.title,
                "updated": s.updated,
                "message_count": s.messages.len(),
                "pinned": s.pinned,
                "agent_id": s.agent_id,
            })
        })
        .collect()
}

/// 返回完整会话（含 messages）。
pub fn get(state: &AgentState, session_id: &str) -> Option<Session> {
    state.sessions.lock().unwrap().get(session_id).cloned()
}

/// 从内存和 DB 中删除会话。
pub async fn delete(app: &AppHandle, state: &AgentState, session_id: &str) -> Result<(), String> {
    {
        let mut sessions = state.sessions.lock().unwrap();
        if sessions.remove(session_id).is_none() {
            return Err("会话不存在".into());
        }
    }
    repo::delete(app, session_id).await;
    Ok(())
}

/// 重命名会话标题并持久化。
pub async fn rename(
    app: &AppHandle,
    state: &AgentState,
    session_id: &str,
    title: String,
) -> Result<(), String> {
    let trimmed = title.trim().to_string();
    if trimmed.is_empty() {
        return Err("标题不能为空".into());
    }
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let s = sessions
            .get_mut(session_id)
            .ok_or_else(|| "会话不存在".to_string())?;
        s.title = trimmed;
        s.updated = now_secs();
        s.clone()
    };
    repo::save(app, &session).await;
    Ok(())
}

/// 设置会话置顶状态并持久化。
pub async fn pin(
    app: &AppHandle,
    state: &AgentState,
    session_id: &str,
    pinned: bool,
) -> Result<(), String> {
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let s = sessions
            .get_mut(session_id)
            .ok_or_else(|| "会话不存在".to_string())?;
        s.pinned = pinned;
        s.clone()
    };
    repo::save(app, &session).await;
    Ok(())
}

// ── Agent Loop 入口 ───────────────────────────────────────────────────────────

/// 主聊天入口：准备上下文 → Agent Loop → 返回 session_id。
pub async fn send_message(
    app: AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    agent_id: Option<String>,
    content: String,
) -> Result<String> {
    let sid = ensure_session(&app, &state, session_id, agent_id.clone()).await;
    push_user_message(&app, &state, &sid, &content).await;

    let workspace_dir = state.sessions.lock().unwrap()
        .get(&sid)
        .and_then(|s| s.workspace_dir.clone());

    // 判断该 session 是否有绑定 agent（有 agent 就有 tools，强制 cloud tier）
    let has_agent = state.sessions.lock().unwrap()
        .get(&sid)
        .and_then(|s| s.agent_id.clone())
        .or_else(|| agent_id.clone())
        .is_some();

    let resolved_agent_id = agent_id.or_else(|| {
        state.sessions.lock().unwrap().get(&sid).and_then(|s| s.agent_id.clone())
    });
    let active_agent = resolve_active_agent(&state, resolved_agent_id.as_deref());
    let system_prompt = build_system_prompt(&state, &content, active_agent);

    // ⑧ 创建中断信号，注册到全局 abort_handles
    let (abort_tx, abort_rx) = watch::channel(false);
    state.abort_handles.lock().unwrap().insert(sid.clone(), abort_tx);

    let result = run_agent_loop(&app, &state, &sid, has_agent, &mut Vec::new(), system_prompt, workspace_dir.as_deref(), abort_rx).await;

    // 清理中断句柄
    state.abort_handles.lock().unwrap().remove(&sid);

    result?;
    Ok(sid)
}

// ── 准备阶段 ──────────────────────────────────────────────────────────────────

fn resolve_active_agent(
    state: &State<'_, AgentState>,
    agent_id: Option<&str>,
) -> Option<crate::agents::AgentProfile> {
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

fn build_system_prompt(
    state: &State<'_, AgentState>,
    content: &str,
    active_agent: Option<crate::agents::AgentProfile>,
) -> Option<String> {
    let mut blocks: Vec<String> = Vec::new();
    if let Some(p) = active_agent.as_ref().map(crate::agents::format_persona) {
        blocks.push(p);
    }
    if let Some(m) = knowledge_block(state, content) {
        blocks.push(m);
    }
    if let Some(s) = skills_block(state, content, active_agent.as_ref()) {
        blocks.push(s);
    }
    if blocks.is_empty() { None } else { Some(blocks.join("\n\n")) }
}

fn knowledge_block(state: &State<'_, AgentState>, content: &str) -> Option<String> {
    let entries = state.knowledge.lock().unwrap().clone();
    let relevant = knowledge::search(&entries, content, 3);
    let text = knowledge::format_for_prompt(&relevant);
    if text.is_empty() { None } else { Some(text) }
}

fn skills_block(
    state: &State<'_, AgentState>,
    content: &str,
    active_agent: Option<&crate::agents::AgentProfile>,
) -> Option<String> {
    let skill_list = state.skills.lock().unwrap().clone();
    let allowlist = active_agent.and_then(|a| a.skills.as_ref().map(|v| v.as_slice()));
    let text = scripts::format_for_prompt(&skill_list, content, allowlist);
    if text.is_empty() { None } else { Some(text) }
}

fn build_api_messages(state: &State<'_, AgentState>, sid: &str, kind: &str) -> Vec<Value> {
    let sessions = state.sessions.lock().unwrap();
    let msgs = sessions.get(sid).map(|s| s.messages.as_slice()).unwrap_or(&[]);
    match kind {
        "anthropic" => provider::messages_to_anthropic(msgs),
        _ => provider::messages_to_openai(msgs),
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
    sid: &str,
    has_tools: bool,
    api_messages: &mut Vec<Value>,
    system_prompt: Option<String>,
    workspace_dir: Option<&str>,
    mut abort_rx: watch::Receiver<bool>,
) -> Result<()> {
    let mut total_input_tokens: u32 = 0;
    let mut total_output_tokens: u32 = 0;

    loop {
        // ⑧ 检查中断信号
        if *abort_rx.borrow() {
            let _ = app.emit("stream-chunk", provider::StreamChunk {
                session_id: sid.to_string(),
                delta: String::new(),
                done: true,
            });
            break;
        }
        // 估算当前 context 大小
        let context_chars: usize = api_messages.iter()
            .map(|m| m.to_string().len())
            .sum();
        let context_tokens = context_chars / 4; // 粗略估算

        // 从 DB 获取所有 profile，通过 router 选择
        let profiles = crate::models::repository::list(app).await;

        // 优先级：session 手动绑定 > 全局手动激活（auto_mode=false）> auto 路由
        let (pinned_profile_id, auto_mode, active_profile_id) = {
            let sessions = state.sessions.lock().unwrap();
            let cfg = state.config.lock().unwrap();
            let pinned = sessions.get(sid).and_then(|s| s.profile_id.clone());
            (pinned, cfg.auto_mode, cfg.active_profile_id.clone())
        };

        let profile = if let Some(pid) = pinned_profile_id {
            // session 级别手动绑定（最高优先）
            profiles.iter().find(|p| p.id == pid && p.enabled).cloned()
        } else if !auto_mode {
            // 全局手动模式：用 active_profile_id 对应的 SQLite profile
            active_profile_id
                .as_deref()
                .and_then(|pid| profiles.iter().find(|p| p.id == pid && p.enabled).cloned())
                .or_else(|| {
                    // fallback 到 router
                    let router = state.router.clone();
                    router.pick(&profiles, has_tools, context_tokens)
                        .and_then(|id| profiles.iter().find(|p| p.id == id).cloned())
                })
        } else {
            // auto 路由（默认）
            let router = state.router.clone();
            router.pick(&profiles, has_tools, context_tokens)
                .and_then(|id| profiles.iter().find(|p| p.id == id).cloned())
        };

        let profile = match profile {
            Some(p) => p,
            None => anyhow::bail!("没有可用的模型配置，请在 Models 页面添加并启用至少一个 Profile"),
        };

        // 初始化或重建 api_messages（首轮）
        if api_messages.is_empty() {
            *api_messages = build_api_messages(state, sid, &profile.kind);
        }

        // ③ context 边界检查：超出 profile 上限 85% 或全局阈值时截断旧消息
        {
            let char_limit = (profile.context_window as usize * 4 * 85 / 100)
                .min(compress::COMPRESS_THRESHOLD_CHARS);
            compress::truncate_api_messages(api_messages, char_limit);
        }

        let all_tools = collect_tools(state).await;

        // ⑧ race: API call vs 中断信号
        let chat_result = tokio::select! {
            r = provider::stream_chat(
                app.clone(),
                &profile,
                sid.to_string(),
                api_messages.clone(),
                all_tools,
                system_prompt.clone(),
            ) => Some(r),
            _ = async {
                loop {
                    if abort_rx.changed().await.is_err() { return; }
                    if *abort_rx.borrow() { return; }
                }
            } => None,
        };

        let output = match chat_result {
            None => {
                // ⑧ 用户中断
                let _ = app.emit("stream-chunk", provider::StreamChunk {
                    session_id: sid.to_string(),
                    delta: String::new(),
                    done: true,
                });
                break;
            }
            Some(Ok(o)) => {
                state.router.mark_success(&profile.id);
                o
            }
            Some(Err(e)) => {
                state.router.mark_failed(&profile.id);
                return Err(e);
            }
        };

        // ⑨ 累计 token 使用量
        total_input_tokens += output.input_tokens;
        total_output_tokens += output.output_tokens;

        if output.tool_calls.is_empty() {
            finalize_assistant_turn(app, state, sid, &output.text).await;
            break;
        }
        append_tool_turn(app, state, &profile.kind, sid, api_messages, &output, workspace_dir).await;
    }

    // ⑨ 发送本次 agent loop 总 token 统计
    if total_input_tokens > 0 || total_output_tokens > 0 {
        let _ = app.emit("session-token-usage", provider::TokenUsageEvent {
            session_id: sid.to_string(),
            input_tokens: total_input_tokens,
            output_tokens: total_output_tokens,
            total_tokens: total_input_tokens + total_output_tokens,
        });
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
    save_snapshot(app, &**state, sid).await;
}

async fn append_tool_turn(
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
        content: crate::chat::truncate::truncate_tool_result(&result.content),
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

// ── 工具回合事件 ──────────────────────────────────────────────────────────────

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

fn emit_tool_result(app: &AppHandle, session_id: &str, result: &tools::ToolResult) {
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
