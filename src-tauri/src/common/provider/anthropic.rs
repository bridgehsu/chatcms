use anyhow::{bail, Result};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use tauri::{AppHandle, Emitter};

use crate::chat::{Message, Role};
use crate::core::tools::{ToolCall, ToolDef, ToolResult};

use super::types::{ProviderOutput, StreamChunk, ThinkingChunk};

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/// 将 thinking_effort 映射为 Anthropic budget_tokens
fn effort_to_budget(effort: &str) -> u64 {
    match effort {
        "low"  => 1_024,
        "high" => 16_000,
        _      => 8_000, // medium（默认）
    }
}

// ── 主流函数 ──────────────────────────────────────────────────────────────────

pub(super) async fn stream_anthropic(
    app: AppHandle,
    profile: &crate::models::ProviderProfile,
    session_id: String,
    api_messages: Vec<Value>,
    tools: Vec<ToolDef>,
    system_prompt: Option<String>,
    mut timing: Option<&mut crate::chat::trace::StreamTiming>,
) -> Result<ProviderOutput> {
    use std::time::Instant;
    let t_req = Instant::now();

    let client = super::http_client();
    let base_url = profile
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.anthropic.com".to_string());
    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));

    let tools_n = tools.len();
    let tools_json: Vec<Value> = tools
        .into_iter()
        .map(|t| {
            json!({
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
            })
        })
        .collect();

    // ── 基础 body ──────────────────────────────────────────────────────────────
    let mut body = json!({
        "model": profile.model,
        "stream": true,
        "messages": api_messages,
    });

    if tools_n > 0 {
        body["tools"] = json!(tools_json);
    }
    if let Some(sys) = system_prompt {
        if !sys.is_empty() {
            body["system"] = json!(sys);
        }
    }

    // ── thinking 模式 ──────────────────────────────────────────────────────────
    if profile.thinking {
        let budget = effort_to_budget(&profile.thinking_effort);
        body["thinking"] = json!({ "type": "enabled", "budget_tokens": budget });
        // Anthropic 要求：开启 thinking 时 temperature 必须为 1
        body["temperature"] = json!(1);
        // max_tokens 必须大于 budget_tokens
        let response_tokens = profile.max_output_tokens.unwrap_or(4096);
        body["max_tokens"] = json!(budget as i64 + response_tokens);
    } else {
        // 普通模式
        body["max_tokens"] = json!(profile.max_output_tokens.unwrap_or(4096));
        if let Some(temp) = profile.temperature {
            body["temperature"] = json!(temp);
        }
    }

    // ── extra_body 透传 ────────────────────────────────────────────────────────
    if let Some(obj) = profile.extra_body.as_object() {
        for (k, v) in obj {
            body[k.as_str()] = v.clone();
        }
    }

    let body_approx_chars = body.to_string().len();
    if let Some(t) = timing.as_mut() {
        t.url = url.clone();
        t.tools_n = tools_n;
        t.body_approx_chars = body_approx_chars;
    }

    // ── 发送请求 ──────────────────────────────────────────────────────────────
    let resp = client
        .post(&url)
        .header("x-api-key", &profile.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    let http_ms = t_req.elapsed().as_millis() as u64;
    if let Some(t) = timing.as_mut() {
        t.http_ms = http_ms;
    }

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        bail!("Anthropic API 错误 ({status}): {err_body}");
    }

    // ── 流式解析 ──────────────────────────────────────────────────────────────
    let mut resp = resp.bytes_stream();
    let mut saw_first_token = false;
    let mut t_first_token: Option<Instant> = None;

    let mut full_text = String::new();
    let mut tool_blocks: HashMap<usize, (String, String, String)> = HashMap::new();
    // 标记哪些 content block 是 thinking 类型
    let mut thinking_indices: HashSet<usize> = HashSet::new();
    let mut finished_tool_calls: Vec<ToolCall> = Vec::new();
    let mut stop_reason = String::new();
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;

    while let Some(chunk) = resp.next().await {
        let chunk = chunk?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" { break; }
                let Ok(val) = serde_json::from_str::<Value>(data) else { continue; };

                match val["type"].as_str().unwrap_or("") {
                    "message_start" => {
                        if let Some(u) = val["message"]["usage"]["input_tokens"].as_u64() {
                            input_tokens = u as u32;
                        }
                    }

                    "content_block_start" => {
                        let idx = val["index"].as_u64().unwrap_or(0) as usize;
                        let block = &val["content_block"];
                        match block["type"].as_str().unwrap_or("") {
                            "tool_use" => {
                                if !saw_first_token {
                                    saw_first_token = true;
                                    t_first_token = Some(Instant::now());
                                    if let Some(tm) = timing.as_mut() {
                                        tm.ttft_ms = Some(t_req.elapsed().as_millis() as u64);
                                    }
                                }
                                let id   = block["id"].as_str().unwrap_or("").to_string();
                                let name = block["name"].as_str().unwrap_or("").to_string();
                                tool_blocks.insert(idx, (id, name, String::new()));
                            }
                            "thinking" => {
                                thinking_indices.insert(idx);
                            }
                            _ => {}
                        }
                    }

                    "content_block_delta" => {
                        let idx   = val["index"].as_u64().unwrap_or(0) as usize;
                        let delta = &val["delta"];

                        if thinking_indices.contains(&idx) {
                            // thinking delta
                            if let Some(t) = delta["thinking"].as_str() {
                                if !saw_first_token {
                                    saw_first_token = true;
                                    t_first_token = Some(Instant::now());
                                    if let Some(tm) = timing.as_mut() {
                                        tm.ttft_ms = Some(t_req.elapsed().as_millis() as u64);
                                    }
                                }
                                let _ = app.emit("thinking-chunk", ThinkingChunk {
                                    session_id: session_id.clone(),
                                    delta: t.to_string(),
                                    done: false,
                                });
                            }
                        } else if delta["type"] == "text_delta" {
                            if let Some(text) = delta["text"].as_str() {
                                if !saw_first_token && !text.is_empty() {
                                    saw_first_token = true;
                                    t_first_token = Some(Instant::now());
                                    if let Some(tm) = timing.as_mut() {
                                        tm.ttft_ms = Some(t_req.elapsed().as_millis() as u64);
                                    }
                                }
                                full_text.push_str(text);
                                let _ = app.emit("stream-chunk", StreamChunk {
                                    session_id: session_id.clone(),
                                    delta: text.to_string(),
                                    done: false,
                                });
                            }
                        } else if delta["type"] == "input_json_delta" {
                            if let Some(partial) = delta["partial_json"].as_str() {
                                if let Some(entry) = tool_blocks.get_mut(&idx) {
                                    entry.2.push_str(partial);
                                }
                            }
                        }
                    }

                    "content_block_stop" => {
                        let idx = val["index"].as_u64().unwrap_or(0) as usize;
                        // thinking block 结束，发送 done 事件
                        if thinking_indices.remove(&idx) {
                            let _ = app.emit("thinking-chunk", ThinkingChunk {
                                session_id: session_id.clone(),
                                delta: String::new(),
                                done: true,
                            });
                        }
                        // tool block 结束
                        if let Some((id, name, json_str)) = tool_blocks.remove(&idx) {
                            let input: Value = serde_json::from_str(&json_str)
                                .unwrap_or(Value::Object(Default::default()));
                            finished_tool_calls.push(ToolCall { id, name, input });
                        }
                    }

                    "message_delta" => {
                        if let Some(sr) = val["delta"]["stop_reason"].as_str() {
                            stop_reason = sr.to_string();
                        }
                        if let Some(u) = val["usage"]["output_tokens"].as_u64() {
                            output_tokens = u as u32;
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if stop_reason != "tool_use" {
        let _ = app.emit("stream-chunk", StreamChunk {
            session_id: session_id.clone(),
            delta: String::new(),
            done: true,
        });
    }

    if let Some(t) = timing.as_mut() {
        t.total_ms = t_req.elapsed().as_millis() as u64;
        t.stream_ms = t_first_token
            .map(|t0| t0.elapsed().as_millis() as u64)
            .unwrap_or(0);
        t.out_chars = full_text.chars().count();
        t.tool_calls_n = finished_tool_calls.len();
    }

    Ok(ProviderOutput {
        text: full_text,
        tool_calls: finished_tool_calls,
        input_tokens,
        output_tokens,
    })
}

// ── 消息格式转换 ──────────────────────────────────────────────────────────────

pub fn messages_to_anthropic(messages: &[Message]) -> Vec<Value> {
    messages
        .iter()
        .filter(|m| m.role != Role::System && m.role != Role::Tool)
        .map(|m| {
            json!({
                "role": match m.role { Role::User => "user", _ => "assistant" },
                "content": m.content,
            })
        })
        .collect()
}

pub(super) fn encode_tool_turn_anthropic(
    output: &ProviderOutput,
    results: &[ToolResult],
) -> Vec<Value> {
    let mut content = Vec::new();
    if !output.text.is_empty() {
        content.push(json!({"type": "text", "text": output.text}));
    }
    for tc in &output.tool_calls {
        content.push(json!({
            "type": "tool_use",
            "id": tc.id,
            "name": tc.name,
            "input": tc.input,
        }));
    }

    let result_blocks: Vec<Value> = results
        .iter()
        .map(|r| {
            json!({
                "type": "tool_result",
                "tool_use_id": r.id,
                "content": r.content,
                "is_error": r.is_error,
            })
        })
        .collect();

    vec![
        json!({"role": "assistant", "content": content}),
        json!({"role": "user", "content": result_blocks}),
    ]
}
