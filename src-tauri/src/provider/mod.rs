use anyhow::Result;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

use crate::config::{AppConfig, ProviderKind};
use crate::memory::{Message, Role};
use crate::tools::{ToolCall, ToolDef};

// ── Events ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamChunk {
    pub session_id: String,
    pub delta: String,
    pub done: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallEvent {
    pub session_id: String,
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolResultEvent {
    pub session_id: String,
    pub id: String,
    pub content: String,
    pub is_error: bool,
}

// ── Provider output ───────────────────────────────────────────────────────────

pub struct ProviderOutput {
    pub text: String,
    pub tool_calls: Vec<ToolCall>,
}

// ── Public entry point ────────────────────────────────────────────────────────

pub async fn stream_chat(
    app: AppHandle,
    config: AppConfig,
    session_id: String,
    api_messages: Vec<Value>,
    tools: Vec<ToolDef>,
    system_prompt: Option<String>,
) -> Result<ProviderOutput> {
    match config.provider.kind {
        ProviderKind::Anthropic => {
            stream_anthropic(app, config, session_id, api_messages, tools, system_prompt).await
        }
        ProviderKind::OpenAI => {
            stream_openai(app, config, session_id, api_messages, tools, system_prompt).await
        }
    }
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async fn stream_anthropic(
    app: AppHandle,
    config: AppConfig,
    session_id: String,
    api_messages: Vec<Value>,
    tools: Vec<ToolDef>,
    system_prompt: Option<String>,
) -> Result<ProviderOutput> {
    let client = Client::new();
    let base_url = config
        .provider
        .base_url
        .unwrap_or_else(|| "https://api.anthropic.com".to_string());

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

    let mut body = json!({
        "model": config.provider.model,
        "max_tokens": 4096,
        "stream": true,
        "tools": tools_json,
        "messages": api_messages,
    });

    if let Some(sys) = system_prompt {
        if !sys.is_empty() {
            body["system"] = json!(sys);
        }
    }

    let mut resp = client
        .post(format!("{}/v1/messages", base_url))
        .header("x-api-key", &config.provider.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?
        .bytes_stream();

    let mut full_text = String::new();
    let mut tool_blocks: HashMap<usize, (String, String, String)> = HashMap::new();
    let mut finished_tool_calls: Vec<ToolCall> = Vec::new();
    let mut stop_reason = String::new();

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

                match val["type"].as_str().unwrap_or("") {
                    "content_block_start" => {
                        let idx = val["index"].as_u64().unwrap_or(0) as usize;
                        let block = &val["content_block"];
                        if block["type"] == "tool_use" {
                            let id = block["id"].as_str().unwrap_or("").to_string();
                            let name = block["name"].as_str().unwrap_or("").to_string();
                            tool_blocks.insert(idx, (id, name, String::new()));
                        }
                    }
                    "content_block_delta" => {
                        let idx = val["index"].as_u64().unwrap_or(0) as usize;
                        let delta = &val["delta"];
                        if delta["type"] == "text_delta" {
                            if let Some(text) = delta["text"].as_str() {
                                full_text.push_str(text);
                                let _ = app.emit(
                                    "stream-chunk",
                                    StreamChunk {
                                        session_id: session_id.clone(),
                                        delta: text.to_string(),
                                        done: false,
                                    },
                                );
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
                    }
                    _ => {}
                }
            }
        }
    }

    if stop_reason != "tool_use" {
        let _ = app.emit(
            "stream-chunk",
            StreamChunk {
                session_id: session_id.clone(),
                delta: String::new(),
                done: true,
            },
        );
    }

    Ok(ProviderOutput {
        text: full_text,
        tool_calls: finished_tool_calls,
    })
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

async fn stream_openai(
    app: AppHandle,
    config: AppConfig,
    session_id: String,
    api_messages: Vec<Value>,
    tools: Vec<ToolDef>,
    system_prompt: Option<String>,
) -> Result<ProviderOutput> {
    let client = Client::new();
    let base_url = config
        .provider
        .base_url
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
        "model": config.provider.model,
        "stream": true,
        "tools": tools_json,
        "messages": messages,
    });

    let mut resp = client
        .post(format!("{}/v1/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", config.provider.api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?
        .bytes_stream();

    let mut full_text = String::new();
    let mut tool_accum: HashMap<usize, (String, String, String)> = HashMap::new();

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

    let mut tool_calls: Vec<ToolCall> = tool_accum
        .into_values()
        .map(|(id, name, args)| {
            let input: Value = serde_json::from_str(&args)
                .unwrap_or(Value::Object(Default::default()));
            ToolCall { id, name, input }
        })
        .collect();
    tool_calls.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(ProviderOutput {
        text: full_text,
        tool_calls,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
