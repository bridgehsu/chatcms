//! 规划层：组装提示词并跑 Agent Loop（内含 execute / response finalize）。

use anyhow::Result;
use tauri::Manager;
use tokio::sync::watch;

use crate::agents::AgentState;
use crate::core::context::TurnContext;
use crate::core::decision;

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
    let intent = ctx
        .intent
        .clone()
        .ok_or_else(|| anyhow::anyhow!("intent missing before plan"))?;

    let app = ctx.app.clone();
    let state = app.state::<AgentState>();
    let active_agent = decision::resolve_active_agent(&state, session_agent_id.as_deref());
    let system_prompt =
        build_system_prompt(&state, &content, active_agent, &intent, mode);

    {
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
        trace.system_chars = system_prompt.as_ref().map(|s| s.chars().count()).unwrap_or(0);
        trace.mark(
            "build_system_prompt",
            format!(
                "system_chars={} mode={}",
                trace.system_chars,
                mode.as_str()
            ),
        );
    }

    ctx.system_prompt = system_prompt.clone();

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
