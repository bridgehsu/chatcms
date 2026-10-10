//! @脚本 编排：分类 →（可选）预执行 → 注入 prompt / 短路回复。

use serde_json::json;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::agents::AgentState;
use crate::chat::attachments::{self, ChatAttachment};
use crate::chat::script_action::{self, ScriptAction};
use crate::chat::Role;
use crate::common::provider::{StreamChunk, ToolCallEvent, ToolResultEvent};
use crate::core::decision::ChatMode;
use crate::core::memory::{self, save_snapshot};
use crate::core::response;
use crate::core::tools::run_page_script;

pub struct ScriptTurnPrep {
    pub action: ScriptAction,
    /// 追加到 system prompt
    pub prompt_extra: Option<String>,
    /// 若 Some，本轮不再进 Agent Loop，直接回复
    pub short_circuit: Option<String>,
}

/// 处理本轮 @脚本：问清楚/需 Agent 时短路；执行时先跑再交给模型总结。
pub async fn prepare(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    content: &str,
    mode: ChatMode,
    attachments: &[ChatAttachment],
) -> ScriptTurnPrep {
    let scripts = attachments::scripts(attachments);
    if scripts.is_empty() {
        return ScriptTurnPrep {
            action: ScriptAction::Ask,
            prompt_extra: None,
            short_circuit: None,
        };
    }

    let action = script_action::classify(content, &scripts);

    match action {
        ScriptAction::Ask => ScriptTurnPrep {
            action,
            prompt_extra: attachments::format_script_action_for_prompt(
                action.as_str(),
                &scripts,
                false,
            ),
            short_circuit: Some(script_action::ask_message(&scripts)),
        },
        ScriptAction::Explain => ScriptTurnPrep {
            action,
            prompt_extra: attachments::format_script_action_for_prompt(
                "explain",
                &scripts,
                false,
            ),
            short_circuit: None,
        },
        ScriptAction::Execute => {
            if !mode.use_tools() {
                return ScriptTurnPrep {
                    action,
                    prompt_extra: None,
                    short_circuit: Some(script_action::need_agent_mode_message(&scripts)),
                };
            }

            let last_assistant = last_assistant_text(state, sid);
            let input =
                script_action::resolve_input(content, &scripts, last_assistant.as_deref());

            if script_action::looks_like_write(content, &scripts) && input.is_none() {
                return ScriptTurnPrep {
                    action: ScriptAction::Ask,
                    prompt_extra: attachments::format_script_action_for_prompt(
                        "ask",
                        &scripts,
                        false,
                    ),
                    short_circuit: Some(script_action::need_write_input_message(&scripts)),
                };
            }

            let mut result_blocks: Vec<String> = Vec::new();
            for s in &scripts {
                let code = s
                    .code
                    .clone()
                    .filter(|c| !c.is_empty())
                    .unwrap_or_else(|| s.id.clone());
                let label = s.label.as_str();
                let call_id = Uuid::new_v4().to_string();
                let tool_input = json!({
                    "code": code,
                    "input": input,
                });
                let _ = app.emit(
                    "tool-call",
                    ToolCallEvent {
                        session_id: sid.to_string(),
                        id: call_id.clone(),
                        name: "run_page_script".into(),
                        input: tool_input.clone(),
                    },
                );

                let outcome =
                    run_page_script::execute_direct(app, sid, code.clone(), input.clone()).await;
                let (content_str, is_error) = match outcome {
                    Ok(body) => (body, false),
                    Err(e) => (e, true),
                };
                let content_str = memory::truncate_tool_result(&content_str);

                let _ = app.emit(
                    "tool-result",
                    ToolResultEvent {
                        session_id: sid.to_string(),
                        id: call_id,
                        content: content_str.clone(),
                        is_error,
                    },
                );

                let input_json =
                    serde_json::to_string(&tool_input).unwrap_or_else(|_| "{}".into());
                let body = if is_error {
                    format!("[error]\n{content_str}")
                } else {
                    content_str.clone()
                };
                let display = format!("[tool: run_page_script | {input_json}]\n{body}");
                {
                    let mut sessions = state.sessions.lock().unwrap();
                    if let Some(session) = sessions.get_mut(sid) {
                        session.push(Role::Tool, &display);
                    }
                }
                save_snapshot(app, &**state, sid).await;

                let status = if is_error { "失败" } else { "成功" };
                result_blocks.push(format!(
                    "### {label} (`{code}`) — {status}\n{content_str}"
                ));
            }

            let mut extra = attachments::format_script_action_for_prompt("execute", &scripts, true)
                .unwrap_or_default();
            extra.push_str("\n\n<script_run_result>\n");
            extra.push_str(&result_blocks.join("\n\n"));
            extra.push_str("\n</script_run_result>");
            if input.is_some() {
                extra.push_str("\n\n注：已向脚本传入用户文案作为 input（填页/写页）。");
            }

            ScriptTurnPrep {
                action,
                prompt_extra: Some(extra),
                short_circuit: None,
            }
        }
    }
}

pub async fn emit_short_reply(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    text: &str,
) {
    let _ = app.emit(
        "stream-chunk",
        StreamChunk {
            session_id: sid.to_string(),
            delta: text.to_string(),
            done: false,
        },
    );
    let _ = app.emit(
        "stream-chunk",
        StreamChunk {
            session_id: sid.to_string(),
            delta: String::new(),
            done: true,
        },
    );
    response::finalize_assistant_turn(app, state, sid, text).await;
}

fn last_assistant_text(state: &State<'_, AgentState>, sid: &str) -> Option<String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(sid)?;
    for m in session.messages.iter().rev() {
        if m.role == Role::Assistant && !m.content.trim().is_empty() {
            return Some(m.content.clone());
        }
    }
    None
}
