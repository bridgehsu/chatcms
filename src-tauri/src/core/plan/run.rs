//! 规划层：拼 prompt →（可选）script_turn / task_turn → Agent Loop。

use anyhow::Result;
use tauri::Manager;
use tokio::sync::watch;

use crate::agents::AgentState;
use crate::chat::attachments;
use crate::chat::ScriptAction;
use crate::core::context::TurnContext;
use crate::core::decision;
use crate::core::intent::Intent;

use super::script_turn::{self, ScriptTurnPrep};
use super::task_turn::{self, TaskTurnPrep};
use super::{build_system_prompt, run_agent_loop};

/// 层入口。
pub async fn run(ctx: &mut TurnContext) -> Result<()> {
    let sid = ctx
        .sid
        .clone()
        .ok_or_else(|| anyhow::anyhow!("session id missing before plan"))?;
    let content = ctx.content.clone();
    let mode = ctx.mode;
    let session_agent_id = ctx.session_agent_id.clone();
    let workspace_dir = ctx.workspace_dir.clone();
    let attachments = ctx.attachments.clone();
    let intent = ctx
        .intent
        .clone()
        .ok_or_else(|| anyhow::anyhow!("intent missing before plan"))?;

    let app = ctx.app.clone();
    let state = app.state::<AgentState>();
    let active_agent = decision::resolve_active_agent(&state, session_agent_id.as_deref());

    let mut system_prompt = build_system_prompt(
        &state,
        &content,
        active_agent,
        &intent,
        mode,
        &attachments,
    );

    // 前置：@脚本 / @任务 硬规则（分类 / 预执行 / 短路）
    let script_prep =
        prepare_script_turn(&app, &state, &sid, &content, mode, &attachments).await;
    let task_prep = prepare_task_turn(&app, &state, &sid, &content, mode, &attachments).await;

    append_prompt(&mut system_prompt, script_prep.as_ref().and_then(|p| p.prompt_extra.as_ref()));
    append_prompt(&mut system_prompt, task_prep.as_ref().and_then(|p| p.prompt_extra.as_ref()));
    mark_plan_trace(
        ctx,
        &intent,
        mode,
        &session_agent_id,
        &system_prompt,
        script_prep.as_ref(),
        task_prep.as_ref(),
    )?;

    ctx.system_prompt = system_prompt.clone();

    if let Some(prep) = &script_prep {
        if let Some(reply) = &prep.short_circuit {
            script_turn::emit_short_reply(&app, &state, &sid, reply).await;
            return Ok(());
        }
        apply_script_tool_policy(ctx, prep.action);
    }
    if let Some(prep) = &task_prep {
        if let Some(reply) = &prep.short_circuit {
            task_turn::emit_short_reply(&app, &state, &sid, reply).await;
            return Ok(());
        }
        apply_script_tool_policy(ctx, prep.action);
    }

    let tools = std::mem::take(&mut ctx.tools);
    let has_tools = !tools.is_empty();

    log::info!(
        target: "chatcms_lib::chat",
        "chat_send session_id={sid} agent_id={:?} mode={} tools={} content_len={} intent={} conf={:.2}",
        session_agent_id,
        mode.as_str(),
        tools.len(),
        content.chars().count(),
        intent.kind.as_str(),
        intent.confidence,
    );

    let (abort_tx, abort_rx) = watch::channel(false);
    state
        .abort_handles
        .lock()
        .unwrap()
        .insert(sid.clone(), abort_tx);

    let result = {
        let trace = ctx
            .trace
            .as_mut()
            .ok_or_else(|| anyhow::anyhow!("trace missing before plan"))?;
        run_agent_loop(
            &app,
            &state,
            &sid,
            has_tools,
            tools,
            &mut Vec::new(),
            system_prompt,
            workspace_dir.as_deref(),
            abort_rx,
            trace,
        )
        .await
    };

    state.abort_handles.lock().unwrap().remove(&sid);

    if let Err(ref e) = result {
        log::error!(
            target: "chatcms_lib::chat",
            "chat_send failed session_id={sid}: {e:#}",
        );
        if let Some(trace) = ctx.trace.as_mut() {
            trace.finish_err(&e.to_string());
        }
        return Err(anyhow::anyhow!("{e:#}"));
    }

    Ok(())
}

async fn prepare_script_turn(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AgentState>,
    sid: &str,
    content: &str,
    mode: crate::core::decision::ChatMode,
    attachments: &[crate::chat::ChatAttachment],
) -> Option<ScriptTurnPrep> {
    if attachments::scripts(attachments).is_empty() {
        return None;
    }
    Some(script_turn::prepare(app, state, sid, content, mode, attachments).await)
}

async fn prepare_task_turn(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AgentState>,
    sid: &str,
    content: &str,
    mode: crate::core::decision::ChatMode,
    attachments: &[crate::chat::ChatAttachment],
) -> Option<TaskTurnPrep> {
    if attachments::tasks(attachments).is_empty() {
        return None;
    }
    Some(task_turn::prepare(app, state, sid, content, mode, attachments).await)
}

fn append_prompt(system_prompt: &mut Option<String>, extra: Option<&String>) {
    let Some(extra) = extra else {
        return;
    };
    *system_prompt = match system_prompt.take() {
        Some(base) => Some(format!("{base}\n\n{extra}")),
        None => Some(extra.clone()),
    };
}

fn apply_script_tool_policy(ctx: &mut TurnContext, action: ScriptAction) {
    // 已预跑或仅讲解：禁止再调工具，避免失败后乱调 web_fetch 等
    if matches!(action, ScriptAction::Explain | ScriptAction::Execute) {
        ctx.tools.clear();
    }
}

fn mark_plan_trace(
    ctx: &mut TurnContext,
    intent: &Intent,
    mode: crate::core::decision::ChatMode,
    session_agent_id: &Option<String>,
    system_prompt: &Option<String>,
    script_prep: Option<&ScriptTurnPrep>,
    task_prep: Option<&TaskTurnPrep>,
) -> Result<()> {
    let trace = ctx
        .trace
        .as_mut()
        .ok_or_else(|| anyhow::anyhow!("trace missing before plan"))?;
    trace.intent_kind = intent.kind.as_str().to_string();
    trace.needs_tools = intent.needs_tools;
    trace.mark(
        "intent",
        format!(
            "kind={} conf={:.2} needs_tools={} mode={} agent={:?}",
            intent.kind.as_str(),
            intent.confidence,
            intent.needs_tools,
            mode.as_str(),
            session_agent_id,
        ),
    );
    if let Some(prep) = script_prep {
        trace.mark(
            "script_action",
            format!(
                "action={} short_circuit={}",
                prep.action.as_str(),
                prep.short_circuit.is_some(),
            ),
        );
    }
    if let Some(prep) = task_prep {
        trace.mark(
            "task_action",
            format!(
                "action={} short_circuit={}",
                prep.action.as_str(),
                prep.short_circuit.is_some(),
            ),
        );
    }
    trace.system_chars = system_prompt.as_ref().map(|s| s.chars().count()).unwrap_or(0);
    trace.mark(
        "build_system_prompt",
        format!(
            "system_chars={} mode={}",
            trace.system_chars,
            mode.as_str()
        ),
    );
    Ok(())
}
