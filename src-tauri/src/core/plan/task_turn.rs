//! @任务 编排：串联脚本；成功非空直出 / 失败或空再交 AI。

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
use super::script_turn::is_useful_script_output;
use crate::core::response;
use crate::core::tools::run_page_script;
use crate::schedules::{self, TaskScriptStep};

pub struct TaskTurnPrep {
    pub action: ScriptAction,
    pub prompt_extra: Option<String>,
    pub short_circuit: Option<String>,
}

pub async fn prepare(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    content: &str,
    mode: ChatMode,
    attachments: &[ChatAttachment],
) -> TaskTurnPrep {
    let tasks = attachments::tasks(attachments);
    if tasks.is_empty() {
        return TaskTurnPrep {
            action: ScriptAction::Ask,
            prompt_extra: None,
            short_circuit: None,
        };
    }

    let action = script_action::classify(content, &tasks);

    // 解析每个任务的脚本链
    let mut resolved: Vec<(String, String, Vec<TaskScriptStep>)> = Vec::new();
    for t in &tasks {
        match schedules::get(app, &t.id) {
            Ok(project) if project.enabled => {
                let steps = schedules::extract_script_chain(&project.workflow);
                if steps.is_empty() {
                    return TaskTurnPrep {
                        action: ScriptAction::Ask,
                        prompt_extra: None,
                        short_circuit: Some(format!(
                            "任务「{}」尚未配置插件脚本节点。请在渠道中心 · 调度中心画布中添加「插件脚本」节点并连线。",
                            t.label
                        )),
                    };
                }
                resolved.push((project.id.clone(), project.name.clone(), steps));
            }
            Ok(_) => {
                return TaskTurnPrep {
                    action: ScriptAction::Ask,
                    prompt_extra: None,
                    short_circuit: Some(format!("任务「{}」已停用，无法执行。", t.label)),
                };
            }
            Err(_) => {
                return TaskTurnPrep {
                    action: ScriptAction::Ask,
                    prompt_extra: None,
                    short_circuit: Some(format!("找不到任务「{}」。", t.label)),
                };
            }
        }
    }

    let step_labels: Vec<String> = resolved
        .iter()
        .flat_map(|(_, name, steps)| {
            steps
                .iter()
                .map(|s| format!("{name}/{label}", label = s.label))
                .collect::<Vec<_>>()
        })
        .collect();

    match action {
        ScriptAction::Ask => TaskTurnPrep {
            action,
            prompt_extra: attachments::format_task_action_for_prompt(
                "ask",
                &tasks,
                &step_labels,
                false,
            ),
            short_circuit: Some(ask_task_message(&tasks, &step_labels)),
        },
        ScriptAction::Explain => TaskTurnPrep {
            action,
            prompt_extra: attachments::format_task_action_for_prompt(
                "explain",
                &tasks,
                &step_labels,
                false,
            ),
            short_circuit: None,
        },
        ScriptAction::Execute => {
            if !mode.use_tools() {
                return TaskTurnPrep {
                    action,
                    prompt_extra: None,
                    short_circuit: Some(script_action::need_agent_mode_message(&tasks)),
                };
            }

            let last_assistant = last_assistant_text(state, sid);
            let mut input =
                script_action::resolve_input(content, &tasks, last_assistant.as_deref());

            // 填/发类任务缺文案时反问
            let looks_write = script_action::looks_like_write(content, &tasks)
                || resolved.iter().any(|(_, _, steps)| {
                    steps.iter().any(|s| {
                        let blob = format!("{} {}", s.label, s.code).to_lowercase();
                        blob.contains("填")
                            || blob.contains("发")
                            || blob.contains("fill")
                            || blob.contains("publish")
                    })
                });
            if looks_write && input.is_none() {
                return TaskTurnPrep {
                    action: ScriptAction::Ask,
                    prompt_extra: attachments::format_task_action_for_prompt(
                        "ask",
                        &tasks,
                        &step_labels,
                        false,
                    ),
                    short_circuit: Some(script_action::need_write_input_message(&tasks)),
                };
            }

            let mut result_blocks: Vec<String> = Vec::new();
            let mut any_error = false;
            let mut useful_outputs: Vec<String> = Vec::new();
            let mut step_count = 0usize;

            for (task_id, task_name, steps) in &resolved {
                let mut prev_out: Option<String> = None;
                for (idx, step) in steps.iter().enumerate() {
                    step_count += 1;
                    let step_input = if idx == 0 {
                        input.clone()
                    } else if step.pass_output {
                        prev_out.clone().or_else(|| input.clone())
                    } else {
                        input.clone()
                    };

                    let call_id = Uuid::new_v4().to_string();
                    let tool_input = json!({
                        "code": step.code,
                        "input": step_input,
                        "task_id": task_id,
                        "task_name": task_name,
                        "step": idx + 1,
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

                    let outcome = run_page_script::execute_direct(
                        app,
                        sid,
                        step.code.clone(),
                        step_input.clone(),
                    )
                    .await;
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

                    let status = if is_error {
                        "失败"
                    } else if is_useful_script_output(&content_str) {
                        "成功"
                    } else {
                        "成功但无有效输出"
                    };
                    result_blocks.push(format!(
                        "### {task_name} · 步骤{} · {} (`{}`) — {status}\n{content_str}",
                        idx + 1,
                        step.label,
                        step.code
                    ));

                    if is_error {
                        any_error = true;
                        break;
                    }
                    if is_useful_script_output(&content_str) {
                        useful_outputs.push(content_str.clone());
                    }
                    prev_out = Some(content_str);
                    if input.is_none()
                        && prev_out
                            .as_ref()
                            .map(|s| s.chars().count() >= 8)
                            == Some(true)
                    {
                        input = prev_out.clone();
                    }
                }
            }

            // 整链成功且每步都有有效正文 → 直出
            let all_useful = !any_error
                && !useful_outputs.is_empty()
                && useful_outputs.len() == step_count;

            if all_useful {
                let reply = if useful_outputs.len() == 1 {
                    useful_outputs.into_iter().next().unwrap_or_default()
                } else {
                    useful_outputs.join("\n\n---\n\n")
                };
                return TaskTurnPrep {
                    action,
                    prompt_extra: None,
                    short_circuit: Some(reply),
                };
            }

            // 整链成功但部分/全部无正文（副作用步常见）→ 直出，不交给 AI 当失败诊断
            if !any_error {
                let reply = if useful_outputs.is_empty() {
                    let names: Vec<&str> = tasks.iter().map(|t| t.label.as_str()).collect();
                    format!("任务「{}」已执行完成（无返回正文）。", names.join("、"))
                } else {
                    useful_outputs.join("\n\n---\n\n")
                };
                return TaskTurnPrep {
                    action,
                    prompt_extra: None,
                    short_circuit: Some(reply),
                };
            }

            // 失败：直出错误，避免会话模型按历史话题编造
            let mut lines = vec!["任务执行失败：".to_string()];
            for b in &result_blocks {
                lines.push(b.clone());
            }
            lines.push(String::new());
            lines.push(
                "请确认扩展已连接、前景标签在目标页，并重新加载扩展后重试。".into(),
            );
            TaskTurnPrep {
                action,
                prompt_extra: None,
                short_circuit: Some(lines.join("\n\n")),
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

fn ask_task_message(tasks: &[&ChatAttachment], step_labels: &[String]) -> String {
    let names: Vec<&str> = tasks.iter().map(|t| t.label.as_str()).collect();
    let chain = if step_labels.is_empty() {
        String::new()
    } else {
        format!("\n\n步骤：{}", step_labels.join(" → "))
    };
    format!(
        "你 @了任务「{}」。{chain}\n\n请确认：\n1. **执行** — 按顺序跑完整条脚本链\n2. **了解** — 只介绍任务用途\n\n可以说「执行一下」或「这是干什么的」。",
        names.join("、")
    )
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
