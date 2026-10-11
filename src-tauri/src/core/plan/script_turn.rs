//! @脚本 编排：分类 → 预执行 → 成功非空直出 / 失败或空再交 AI。

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
    /// 追加到 system prompt（失败/空结果走 AI 时使用）
    pub prompt_extra: Option<String>,
    /// 若 Some，本轮不再进 Agent Loop，直接回复
    pub short_circuit: Option<String>,
}

struct ScriptRunItem {
    label: String,
    code: String,
    content: String,
    is_error: bool,
}

/// 处理本轮 @脚本。
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

            let mut runs: Vec<ScriptRunItem> = Vec::new();
            for s in &scripts {
                let code = s
                    .code
                    .clone()
                    .filter(|c| !c.is_empty())
                    .unwrap_or_else(|| s.id.clone());
                let label = s.label.clone();
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

                runs.push(ScriptRunItem {
                    label,
                    code,
                    content: content_str,
                    is_error,
                });
            }

            finish_execute(action, &scripts, &runs, input.is_some())
        }
    }
}

fn finish_execute(
    action: ScriptAction,
    scripts: &[&ChatAttachment],
    runs: &[ScriptRunItem],
    had_input: bool,
) -> ScriptTurnPrep {
    let any_error = runs.iter().any(|r| r.is_error);
    let needs_llm = runs
        .iter()
        .any(|r| !r.is_error && content_needs_llm(&r.content));
    let useful: Vec<&ScriptRunItem> = runs
        .iter()
        .filter(|r| !r.is_error && is_useful_script_output(&r.content))
        .collect();

    // 全部成功、有正文、且未要求 AI 解析 → 直出正文
    if !any_error && !needs_llm && !useful.is_empty() && useful.len() == runs.len() {
        let reply = if useful.len() == 1 {
            useful[0].content.clone()
        } else {
            useful
                .iter()
                .map(|r| format!("### {}\n{}", r.label, r.content))
                .collect::<Vec<_>>()
                .join("\n\n")
        };
        return ScriptTurnPrep {
            action,
            prompt_extra: None,
            short_circuit: Some(reply),
        };
    }

    // 全部成功但无正文：填表类可忽略；采集类多半是扩展没采到页 / 返回值被丢弃
    if !any_error && !needs_llm {
        let reply = if runs.len() == 1 {
            let label = &runs[0].label;
            let code = &runs[0].code;
            let looks_collect = !script_action::looks_like_write("", scripts)
                && (label.contains("采集")
                    || label.contains("解析")
                    || label.contains("JD")
                    || code.contains("COLLECT")
                    || code.contains("PARSE")
                    || code.contains("JD"));
            if looks_collect {
                format!(
                    "脚本「{label}」执行成功但未返回正文。\n\
请确认：前景标签是目标网页且已加载完成；扩展已重新加载最新 dist；\
若页面正文很大，请更新到会返回 ai_complete 精简结果的脚本版本后重试。"
                )
            } else {
                format!("脚本「{label}」已执行完成（无返回正文，填表/副作用脚本可忽略）。")
            }
        } else {
            runs.iter()
                .map(|r| format!("- {}：已执行完成", r.label))
                .collect::<Vec<_>>()
                .join("\n")
        };
        return ScriptTurnPrep {
            action,
            prompt_extra: None,
            short_circuit: Some(reply),
        };
    }

    // 失败（含扩展超时）：直接直出错误，禁止会话模型按历史话题（如开场白）瞎编
    if any_error {
        let mut lines = vec!["脚本执行失败：".to_string()];
        for r in runs {
            if r.is_error {
                lines.push(format!("- {}（`{}`）：{}", r.label, r.code, r.content.trim()));
            } else if is_useful_script_output(&r.content) {
                lines.push(format!("- {}（`{}`）：成功", r.label, r.code));
            }
        }
        lines.push(String::new());
        lines.push("请检查：".into());
        lines.push("1. 浏览器扩展已加载且桥接 connected（127.0.0.1:17890）".into());
        lines.push("2. 前景标签停在目标网页（如 BOSS 职位详情），不是扩展页".into());
        lines.push("3. 扩展已重新加载到最新 dist 后重试 @脚本".into());
        let _ = had_input;
        return ScriptTurnPrep {
            action,
            prompt_extra: None,
            short_circuit: Some(lines.join("\n")),
        };
    }

    // 仅兼容旧脚本仍带【需要AI解析】时交给会话模型
    let mut result_blocks: Vec<String> = Vec::new();
    for r in runs {
        let status = if is_useful_script_output(&r.content) {
            "成功"
        } else {
            "成功但无正文"
        };
        result_blocks.push(format!(
            "### {} (`{}`) — {status}\n{}",
            r.label, r.code, r.content
        ));
    }

    let mut extra = attachments::format_script_action_for_prompt("execute", scripts, true)
        .unwrap_or_default();
    extra.push_str(
        "\n\n<script_run_result> still contains marker 需要AI解析. Follow 【AI任务】, organize in Chinese, write 未找到 for missing fields. Do NOT call run_page_script again. Do NOT invent greetings or unrelated content.\n",
    );
    extra.push_str("\n<script_run_result>\n");
    extra.push_str(&result_blocks.join("\n\n"));
    extra.push_str("\n</script_run_result>");
    if had_input {
        extra.push_str("\n\n注：已向脚本传入用户文案作为 input（填页/写页）。");
    }

    ScriptTurnPrep {
        action,
        prompt_extra: Some(extra),
        short_circuit: None,
    }
}

/// 有可读正文的成功结果（排除「无返回内容」类空成功）。
pub fn is_useful_script_output(s: &str) -> bool {
    let t = s.trim();
    if t.is_empty() {
        return false;
    }
    if t.contains("无返回内容") {
        return false;
    }
    true
}

/// 脚本声明需要模型继续解析（如 JD 整理）。
fn content_needs_llm(s: &str) -> bool {
    s.contains("【需要AI解析】") || s.contains("__CHATCMS_NEEDS_LLM__")
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
