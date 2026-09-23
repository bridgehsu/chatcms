use anyhow::{bail, Result};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

use crate::chat::{Message, Role};
use crate::core::tools::{ToolDef, ToolResult};

use super::types::{ProviderOutput, StreamChunk, ThinkingChunk};

// ── think 标签状态机 ──────────────────────────────────────────────────────────

const THINK_OPEN:  &str = "<think>";
const THINK_CLOSE: &str = "</think>";

/// 写入思考开关。Ollama `/v1` 常忽略顶层 `think`，需同时发 `reasoning_effort`。
fn apply_thinking_flags(body: &mut Value, thinking: bool, effort: &str) {
    body["think"] = json!(thinking);
    body["enable_thinking"] = json!(thinking);
    body["chat_template_kwargs"] = json!({ "enable_thinking": thinking });
    if thinking {
        let e = match effort {
            "low" | "high" | "medium" => effort,
            _ => "medium",
        };
        body["reasoning_effort"] = json!(e);
    } else {
        // Ollama OpenAI 兼容层关掉 Qwen3 思考的可靠字段
        body["reasoning_effort"] = json!("none");
    }
}

/// 回退到合法 UTF-8 字符边界，避免按字节截断中文 panic。
fn floor_char_boundary(s: &str, mut i: usize) -> usize {
    if i >= s.len() {
        return s.len();
    }
    while i > 0 && !s.is_char_boundary(i) {
        i -= 1;
    }
    i
}

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
                    let safe = floor_char_boundary(tag_buf, tag_buf.len() - keep);
                    if safe > 0 {
                        thinkings.push(tag_buf[..safe].to_string());
                        *tag_buf = tag_buf[safe..].to_string();
                    }
                }
                break;
            }
        } else if let Some(start) = tag_buf.find(THINK_OPEN) {
            let part = tag_buf[..start].to_string();
            if !part.is_empty() { normals.push(part); }
            *in_think = true;
            *tag_buf = tag_buf[start + THINK_OPEN.len()..].to_string();
        } else {
            // 保留末尾 len(THINK_OPEN)-1 个字符，防止标签跨 chunk 分割
            let keep = THINK_OPEN.len() - 1;
            if tag_buf.len() > keep {
                let safe = floor_char_boundary(tag_buf, tag_buf.len() - keep);
                if safe > 0 {
                    normals.push(tag_buf[..safe].to_string());
                    *tag_buf = tag_buf[safe..].to_string();
                }
            }
            break;
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
    mut timing: Option<&mut crate::chat::trace::StreamTiming>,
) -> Result<ProviderOutput> {
    use std::time::Instant;
    let t_req = Instant::now();

    let client = super::http_client();
    let base_url = profile
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com".to_string());
    // 兼容：用户填 base_url 时可能带 /v1 后缀
    let base_url = base_url.trim_end_matches('/').trim_end_matches("/v1").to_string();
    let url = format!("{}/v1/chat/completions", base_url);

    let tools_n = tools.len();
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
        "messages": messages,
    });

    // 无工具时不要带 tools 字段：部分本地后端（Ollama/Qwen）见空数组仍走 tool/慢路径
    if tools_n > 0 {
        body["tools"] = json!(tools_json);
    }

    if let Some(temp) = profile.temperature {
        body["temperature"] = json!(temp);
    }
    if let Some(max_tok) = profile.max_output_tokens {
        body["max_tokens"] = json!(max_tok);
    }

    // extra_body 透传；思考开关最后再写，避免被 {"think":true} 盖掉
    if let Some(obj) = profile.extra_body.as_object() {
        for (k, v) in obj {
            body[k.as_str()] = v.clone();
        }
    }
    apply_thinking_flags(&mut body, profile.thinking, &profile.thinking_effort);

    let body_approx_chars = body.to_string().len();
    if let Some(t) = timing.as_mut() {
        t.url = url.clone();
        t.tools_n = tools_n;
        t.body_approx_chars = body_approx_chars;
    }

    // ── 发送请求 ──────────────────────────────────────────────────────────────
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", profile.api_key))
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
        bail!("OpenAI API 错误 ({status}): {err_body}");
    }

    // ── 流式解析 ──────────────────────────────────────────────────────────────
    let mut resp = resp.bytes_stream();
    let mut saw_first_token = false;
    let mut t_first_token: Option<Instant> = None;

    let mut full_text = String::new();
    let mut tool_accum: HashMap<usize, (String, String, String)> = HashMap::new();
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;

    // think 标签解析状态（仅 thinking=true 时启用）
    let mut in_think = false;
    let mut tag_buf = String::new();
    let mut warned_ignored_off = false;

    while let Some(chunk) = resp.next().await {
        let chunk = chunk?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" { break; }
                let Ok(val) = serde_json::from_str::<Value>(data) else { continue; };

                let delta = &val["choices"][0]["delta"];

                // 部分后端（Qwen/DeepSeek）先推 reasoning_content；仅 thinking=true 时展示
                if profile.thinking {
                    if let Some(reason) = delta["reasoning_content"]
                        .as_str()
                        .or_else(|| delta["reasoning"].as_str())
                    {
                        if !reason.is_empty() {
                            if !saw_first_token {
                                saw_first_token = true;
                                t_first_token = Some(Instant::now());
                                if let Some(t) = timing.as_mut() {
                                    t.ttft_ms = Some(t_req.elapsed().as_millis() as u64);
                                }
                            }
                            let _ = app.emit("thinking-chunk", ThinkingChunk {
                                session_id: session_id.clone(),
                                delta: reason.to_string(),
                                done: false,
                            });
                        }
                    }
                } else if !warned_ignored_off
                    && delta["reasoning_content"].as_str().or_else(|| delta["reasoning"].as_str())
                        .is_some_and(|s| !s.is_empty())
                {
                    warned_ignored_off = true;
                    // 关了思考但服务端仍在推 reasoning → /v1 可能忽略了 think:false
                    log::warn!(
                        target: "chatcms_lib::provider",
                        "thinking=false 但仍收到 reasoning_content，服务端可能未尊重关闭开关"
                    );
                }

                if let Some(content) = delta["content"].as_str() {
                    if !saw_first_token && !content.is_empty() {
                        saw_first_token = true;
                        t_first_token = Some(Instant::now());
                        if let Some(t) = timing.as_mut() {
                            t.ttft_ms = Some(t_req.elapsed().as_millis() as u64);
                        }
                    }
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
                            if !saw_first_token {
                                saw_first_token = true;
                                t_first_token = Some(Instant::now());
                                if let Some(t) = timing.as_mut() {
                                    t.ttft_ms = Some(t_req.elapsed().as_millis() as u64);
                                }
                            }
                            let _ = app.emit("thinking-chunk", ThinkingChunk {
                                session_id: session_id.clone(),
                                delta: part,
                                done: false,
                            });
                        }
                    } else {
                        // thinking=false：丢掉服务端仍可能返回的 <think> 块，避免当正文刷出来
                        let mut text = content.to_string();
                        if (text.contains(THINK_OPEN) || text.contains(THINK_CLOSE) || in_think || !tag_buf.is_empty()) {
                            let (normals, _thinkings) =
                                split_think(content, &mut in_think, &mut tag_buf);
                            text = normals.join("");
                        }
                        if !text.is_empty() {
                            full_text.push_str(&text);
                            let _ = app.emit("stream-chunk", StreamChunk {
                                session_id: session_id.clone(),
                                delta: text,
                                done: false,
                            });
                        }
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
                    if !saw_first_token {
                        saw_first_token = true;
                        t_first_token = Some(Instant::now());
                        if let Some(t) = timing.as_mut() {
                            t.ttft_ms = Some(t_req.elapsed().as_millis() as u64);
                        }
                    }
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

    let mut tool_calls: Vec<crate::core::tools::ToolCall> = tool_accum
        .into_iter()
        .map(|(idx, (id, name, args))| {
            let id = if id.is_empty() { format!("call_{idx}") } else { id };
            let input: Value = serde_json::from_str(&args)
                .unwrap_or(Value::Object(Default::default()));
            crate::core::tools::ToolCall { id, name, input }
        })
        .collect();
    tool_calls.sort_by(|a, b| a.id.cmp(&b.id));

    if let Some(t) = timing.as_mut() {
        t.total_ms = t_req.elapsed().as_millis() as u64;
        t.stream_ms = t_first_token
            .map(|t0| t0.elapsed().as_millis() as u64)
            .unwrap_or(0);
        t.out_chars = full_text.chars().count();
        t.tool_calls_n = tool_calls.len();
    }

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
