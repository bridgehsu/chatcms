use anyhow::{bail, Result};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

use crate::chat::{Message, Role};
use crate::agents::tools::{ToolDef, ToolResult};

use super::types::{ProviderOutput, StreamChunk, ThinkingChunk};

// ── think 标签状态机 ──────────────────────────────────────────────────────────

const THINK_OPEN:  &str = "<think>";
const THINK_CLOSE: &str = "</think>";

/// 将一段 delta 内容按 `<think>...</think>` 拆分。
///
/// 返回 (normal_parts, thinking_parts)，每个 part 均已准备好 emit。
/// `in_think` 和 `tag_buf` 为跨 chunk 的持久状态。
fn split_think(
    content: &str,
    in_think: &mut bool,
    tag_buf: &mut String,
) -> (Vec<String>, Vec<String>) {
    tag_buf.push_str(content);
    let mut normals: Vec<String> = Vec::new();
    let mut thinkings: Vec<String> = Vec::new();

    loop {
        if *in_think {
            if let Some(end) = tag_buf.find(THINK_CLOSE) {
                let part = tag_buf[..end].to_string();
                if !part.is_empty() { thinkings.push(part); }
                *in_think = false;
                *tag_buf = tag_buf[end + THINK_CLOSE.len()..].to_string();
            } else {
                // 可能分割在边界：保留末尾 len(THINK_CLOSE)-1 个字符
                let keep = THINK_CLOSE.len() - 1;
                if tag_buf.len() > keep {
                    let safe = tag_buf.len() - keep;
                    thinkings.push(tag_buf[..safe].to_string());
                    *tag_buf = tag_buf[safe..].to_string();
                }
                break;
            }
        } else {
            if let Some(start) = tag_buf.find(THINK_OPEN) {
                let part = tag_buf[..start].to_string();
                if !part.is_empty() { normals.push(part); }
                *in_think = true;
                *tag_buf = tag_buf[start + THINK_OPEN.len()..].to_string();
            } else {
                // 保留末尾 len(THINK_OPEN)-1 个字符，防止标签跨 chunk 分割
                let keep = THINK_OPEN.len() - 1;
                if tag_buf.len() > keep {
                    let safe = tag_buf.len() - keep;
                    normals.push(tag_buf[..safe].to_string());
                    *tag_buf = tag_buf[safe..].to_string();
                }
                break;
            }
        }
    }

    (normals, thinkings)
}

// ── 主流函数 ──────────────────────────────────────────────────────────────────

pub(super) async fn stream_openai(
    app: AppHandle,
    profile: &crate::models::ProviderProfile,
    session_id: String,
    api_messages: Vec<Value>,
    tools: Vec<ToolDef>,
    system_prompt: Option<String>,
) -> Result<ProviderOutput> {
    let client = Client::new();
    let base_url = profile
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com".to_string());
    // 兼容：用户填 base_url 时可能带 /v1 后缀
    let base_url = base_url.trim_end_matches('/').trim_end_matches("/v1").to_string();

    let tools_json: Vec<Value> = tools
        .into_iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema,
                }
            })
        })
        .collect();

    // Prepend system message if provided
    let mut messages = api_messages;
    if let Some(sys) = system_prompt {
        if !sys.is_empty() {
            messages.insert(0, json!({"role": "system", "content": sys}));
        }
    }

    // ── 构建 body ─────────────────────────────────────────────────────────────
    let mut body = json!({
        "model": profile.model,
        "stream": true,
        "stream_options": {"include_usage": true},
        "tools": tools_json,
        "messages": messages,
    });

    if let Some(temp) = profile.temperature {
        body["temperature"] = json!(temp);
    }
    if let Some(max_tok) = profile.max_output_tokens {
        body["max_tokens"] = json!(max_tok);
    }

    // extra_body 透传（如 Ollama 的 {"think": true}）
    if let Some(obj) = profile.extra_body.as_object() {
        for (k, v) in obj {
            body[k.as_str()] = v.clone();
        }
    }

    // ── 发送请求 ──────────────────────────────────────────────────────────────
    let resp = client
        .post(format!("{}/v1/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", profile.api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        bail!("OpenAI API 错误 ({status}): {err_body}");
    }

    // ── 流式解析 ──────────────────────────────────────────────────────────────
    let mut resp = resp.bytes_stream();

    let mut full_text = String::new();
    let mut tool_accum: HashMap<usize, (String, String, String)> = HashMap::new();
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;

    // think 标签解析状态（仅 thinking=true 时启用）
    let mut in_think = false;
    let mut tag_buf = String::new();

    while let Some(chunk) = resp.next().await {
        let chunk = chunk?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" { break; }
                let Ok(val) = serde_json::from_str::<Value>(data) else { continue; };

                let delta = &val["choices"][0]["delta"];

                if let Some(content) = delta["content"].as_str() {
                    if profile.thinking {
                        // 状态机拆分 <think> 标签
                        let (normals, thinkings) =
                            split_think(content, &mut in_think, &mut tag_buf);

                        for part in normals {
                            full_text.push_str(&part);
                            let _ = app.emit("stream-chunk", StreamChunk {
                                session_id: session_id.clone(),
                                delta: part,
                                done: false,
                            });
                        }
                        for part in thinkings {
                            let _ = app.emit("thinking-chunk", ThinkingChunk {
                                session_id: session_id.clone(),
                                delta: part,
                                done: false,
                            });
                        }
                    } else {
                        full_text.push_str(content);
                        let _ = app.emit("stream-chunk", StreamChunk {
                            session_id: session_id.clone(),
                            delta: content.to_string(),
                            done: false,
                        });
                    }
                }

                // Usage comes in final chunk (stream_options.include_usage=true)
                if let Some(usage) = val.get("usage").filter(|u| !u.is_null()) {
                    if let Some(p) = usage["prompt_tokens"].as_u64() {
                        input_tokens = p as u32;
                    }
                    if let Some(c) = usage["completion_tokens"].as_u64() {
                        output_tokens = c as u32;
                    }
                }

                if let Some(tc_arr) = delta["tool_calls"].as_array() {
                    for tc in tc_arr {
                        let idx = tc["index"].as_u64().unwrap_or(0) as usize;
                        let entry = tool_accum.entry(idx).or_insert_with(|| {
                            let id   = tc["id"].as_str().unwrap_or("").to_string();
                            let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                            (id, name, String::new())
                        });
                        if entry.0.is_empty() {
                            if let Some(id) = tc["id"].as_str() { entry.0 = id.to_string(); }
                        }
                        if entry.1.is_empty() {
                            if let Some(n) = tc["function"]["name"].as_str() { entry.1 = n.to_string(); }
                        }
                        if let Some(args) = tc["function"]["arguments"].as_str() {
                            entry.2.push_str(args);
                        }
                    }
                }
            }
        }
    }

    // 流结束后冲刷 tag_buf 剩余内容（正常文本）
    if profile.thinking && !tag_buf.is_empty() && !in_think {
        full_text.push_str(&tag_buf);
        let _ = app.emit("stream-chunk", StreamChunk {
            session_id: session_id.clone(),
            delta: tag_buf.clone(),
            done: false,
        });
    }

    // thinking done 信号
    if profile.thinking {
        let _ = app.emit("thinking-chunk", ThinkingChunk {
            session_id: session_id.clone(),
            delta: String::new(),
            done: true,
        });
    }

    let _ = app.emit("stream-chunk", StreamChunk {
        session_id: session_id.clone(),
        delta: String::new(),
        done: true,
    });

    let mut tool_calls: Vec<crate::agents::tools::ToolCall> = tool_accum
        .into_iter()
        .map(|(idx, (id, name, args))| {
            let id = if id.is_empty() { format!("call_{idx}") } else { id };
            let input: Value = serde_json::from_str(&args)
                .unwrap_or(Value::Object(Default::default()));
            crate::agents::tools::ToolCall { id, name, input }
        })
        .collect();
    tool_calls.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(ProviderOutput {
        text: full_text,
        tool_calls,
        input_tokens,
        output_tokens,
    })
}

// ── 消息格式转换 ──────────────────────────────────────────────────────────────

pub fn messages_to_openai(messages: &[Message]) -> Vec<Value> {
    messages
        .iter()
        .filter(|m| m.role != Role::Tool)
        .map(|m| {
            json!({
                "role": match m.role {
                    Role::User   => "user",
                    Role::System => "system",
                    _            => "assistant",
                },
                "content": m.content,
            })
        })
        .collect()
}

pub(super) fn encode_tool_turn_openai(
    output: &ProviderOutput,
    results: &[ToolResult],
) -> Vec<Value> {
    let tool_calls: Vec<Value> = output
        .tool_calls
        .iter()
        .enumerate()
        .map(|(i, tc)| {
            let id = if tc.id.is_empty() { format!("call_{i}") } else { tc.id.clone() };
            let arguments = serde_json::to_string(&tc.input).unwrap_or_else(|_| "{}".into());
            json!({
                "id": id,
                "type": "function",
                "function": { "name": tc.name, "arguments": arguments }
            })
        })
        .collect();

    let assistant_content = if output.text.is_empty() { Value::Null } else { json!(output.text) };

    let mut msgs = vec![json!({
        "role": "assistant",
        "content": assistant_content,
        "tool_calls": tool_calls,
    })];

    for (i, result) in results.iter().enumerate() {
        let tool_call_id = if result.id.is_empty() {
            output.tool_calls.get(i)
                .map(|tc| if tc.id.is_empty() { format!("call_{i}") } else { tc.id.clone() })
                .unwrap_or_else(|| format!("call_{i}"))
        } else {
            result.id.clone()
        };
        msgs.push(json!({
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": result.content,
        }));
    }

    msgs
}
