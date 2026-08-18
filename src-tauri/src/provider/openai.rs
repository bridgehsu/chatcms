use anyhow::{bail, Result};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

use crate::chat::{Message, Role};
use crate::tools::{ToolDef, ToolResult};

use super::types::{ProviderOutput, StreamChunk};

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

    let body = json!({
        "model": profile.model,
        "stream": true,
        "stream_options": {"include_usage": true},
        "tools": tools_json,
        "messages": messages,
    });

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

    let mut resp = resp.bytes_stream();

    let mut full_text = String::new();
    let mut tool_accum: HashMap<usize, (String, String, String)> = HashMap::new();
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;

    while let Some(chunk) = resp.next().await {
        let chunk = chunk?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    break;
                }
                let Ok(val) = serde_json::from_str::<Value>(data) else {
                    continue;
                };

                let delta = &val["choices"][0]["delta"];

                if let Some(content) = delta["content"].as_str() {
                    full_text.push_str(content);
                    let _ = app.emit(
                        "stream-chunk",
                        StreamChunk {
                            session_id: session_id.clone(),
                            delta: content.to_string(),
                            done: false,
                        },
                    );
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
                            let id = tc["id"].as_str().unwrap_or("").to_string();
                            let name =
                                tc["function"]["name"].as_str().unwrap_or("").to_string();
                            (id, name, String::new())
                        });
                        if entry.0.is_empty() {
                            if let Some(id) = tc["id"].as_str() {
                                entry.0 = id.to_string();
                            }
                        }
                        if entry.1.is_empty() {
                            if let Some(name) = tc["function"]["name"].as_str() {
                                entry.1 = name.to_string();
                            }
                        }
                        if let Some(args) = tc["function"]["arguments"].as_str() {
                            entry.2.push_str(args);
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit(
        "stream-chunk",
        StreamChunk {
            session_id: session_id.clone(),
            delta: String::new(),
            done: true,
        },
    );

    let mut tool_calls: Vec<crate::tools::ToolCall> = tool_accum
        .into_iter()
        .map(|(idx, (id, name, args))| {
            let id = if id.is_empty() {
                format!("call_{idx}")
            } else {
                id
            };
            let input: Value = serde_json::from_str(&args)
                .unwrap_or(Value::Object(Default::default()));
            crate::tools::ToolCall { id, name, input }
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

pub fn messages_to_openai(messages: &[Message]) -> Vec<Value> {
    messages
        .iter()
        .filter(|m| m.role != Role::Tool)
        .map(|m| {
            json!({
                "role": match m.role {
                    Role::User => "user",
                    Role::System => "system",
                    _ => "assistant",
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
            let id = if tc.id.is_empty() {
                format!("call_{i}")
            } else {
                tc.id.clone()
            };
            let arguments = serde_json::to_string(&tc.input).unwrap_or_else(|_| "{}".into());
            json!({
                "id": id,
                "type": "function",
                "function": {
                    "name": tc.name,
                    "arguments": arguments,
                }
            })
        })
        .collect();

    // Chat Completions：有 tool_calls 时 content 常用 null；部分兼容网关更吃空字符串
    let assistant_content = if output.text.is_empty() {
        Value::Null
    } else {
        json!(output.text)
    };

    let mut msgs = vec![json!({
        "role": "assistant",
        "content": assistant_content,
        "tool_calls": tool_calls,
    })];

    for (i, result) in results.iter().enumerate() {
        let tool_call_id = if result.id.is_empty() {
            output
                .tool_calls
                .get(i)
                .map(|tc| {
                    if tc.id.is_empty() {
                        format!("call_{i}")
                    } else {
                        tc.id.clone()
                    }
                })
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
