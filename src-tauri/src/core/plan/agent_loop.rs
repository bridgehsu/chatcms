//! Agent Loop：选模型 → 截断上下文 → stream_chat → 工具回环或结束。

use anyhow::Result;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::watch;

use super::{build_api_messages, compress};
use crate::core::tools;
use crate::agents::AgentState;
use crate::core::execute;
use crate::core::response;
use crate::chat::trace::{self, ChatTrace, StreamTiming};
use crate::common::provider;

pub async fn run_agent_loop(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    sid: &str,
    has_tools: bool,
    all_tools: Vec<tools::ToolDef>,
    api_messages: &mut Vec<Value>,
    system_prompt: Option<String>,
    workspace_dir: Option<&str>,
    mut abort_rx: watch::Receiver<bool>,
    trace: &mut ChatTrace,
) -> Result<()> {
    let mut total_input_tokens: u32 = 0;
    let mut total_output_tokens: u32 = 0;
    let mut loop_round: usize = 0;

    loop {
        loop_round += 1;
        if *abort_rx.borrow() {
            let _ = app.emit(
                "stream-chunk",
                provider::StreamChunk {
                    session_id: sid.to_string(),
                    delta: String::new(),
                    done: true,
                },
            );
            trace.mark("aborted", format!("round={loop_round}"));
            break;
        }

        let context_chars: usize = api_messages.iter().map(|m| m.to_string().len()).sum();
        let context_tokens = context_chars / 4;
        let pinned_profile_id = state
            .sessions
            .lock()
            .unwrap()
            .get(sid)
            .and_then(|s| s.profile_id.clone());

        let profile = super::resolve_profile(
            app,
            state,
            pinned_profile_id,
            has_tools,
            context_tokens,
        )
        .await?;

        if loop_round == 1 {
            trace.model = profile.model.clone();
            trace.base_url = trace::redact_base_url(profile.base_url.as_deref().unwrap_or(""));
            trace.thinking = profile.thinking;
            trace.mark(
                "pick_model",
                format!(
                    "id={} name={} model={} base_url={} thinking={}",
                    profile.id, profile.name, trace.model, trace.base_url, trace.thinking
                ),
            );
        }

        if api_messages.is_empty() {
            *api_messages = build_api_messages(state, sid, &profile.kind);
        }

        {
            let char_limit = (profile.context_window as usize * 4 * 85 / 100)
                .min(compress::COMPRESS_THRESHOLD_CHARS);
            compress::truncate_api_messages(api_messages, char_limit);
        }

        let all_tools = all_tools.clone();
        if loop_round == 1 {
            trace.tools_count = all_tools.len();
            trace.msg_count = api_messages.len();
            let messages_chars: usize = api_messages.iter().map(|m| m.to_string().len()).sum();
            trace.mark(
                "prepare_request",
                format!(
                    "msg_count={} tools_count={} messages_chars={}",
                    trace.msg_count, trace.tools_count, messages_chars
                ),
            );
        }

        let mut stream_timing = StreamTiming::default();

        let chat_result = tokio::select! {
            r = provider::stream_chat(
                app.clone(),
                &profile,
                sid.to_string(),
                api_messages.clone(),
                all_tools,
                system_prompt.clone(),
                Some(&mut stream_timing),
            ) => Some(r),
            _ = async {
                loop {
                    if abort_rx.changed().await.is_err() { return; }
                    if *abort_rx.borrow() { return; }
                }
            } => None,
        };

        trace.apply_stream(&stream_timing);

        let output = match chat_result {
            None => {
                let _ = app.emit(
                    "stream-chunk",
                    provider::StreamChunk {
                        session_id: sid.to_string(),
                        delta: String::new(),
                        done: true,
                    },
                );
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

        total_input_tokens += output.input_tokens;
        total_output_tokens += output.output_tokens;
        trace.input_tokens = total_input_tokens;
        trace.output_tokens = total_output_tokens;

        if output.tool_calls.is_empty() {
            response::finalize_assistant_turn(app, state, sid, &output.text).await;
            break;
        }
        let tool_names: Vec<&str> = output.tool_calls.iter().map(|t| t.name.as_str()).collect();
        let t_tools = std::time::Instant::now();
        execute::run(
            app,
            state,
            &profile.kind,
            sid,
            api_messages,
            &output,
            workspace_dir,
        )
        .await;
        trace.tool_rounds += 1;
        trace.mark(
            "tool_round",
            format!(
                "round={} tools={:?} duration_ms={}",
                trace.tool_rounds,
                tool_names,
                t_tools.elapsed().as_millis()
            ),
        );
    }

    if total_input_tokens > 0 || total_output_tokens > 0 {
        let _ = app.emit(
            "session-token-usage",
            provider::TokenUsageEvent {
                session_id: sid.to_string(),
                input_tokens: total_input_tokens,
                output_tokens: total_output_tokens,
                total_tokens: total_input_tokens + total_output_tokens,
            },
        );
    }

    Ok(())
}
