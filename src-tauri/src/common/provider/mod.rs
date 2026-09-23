//! AI Provider 流式请求（Anthropic / OpenAI 兼容）

use anyhow::{bail, Result};
use reqwest::{Client, Proxy};
use serde_json::Value;
use std::sync::{LazyLock, RwLock};

use crate::core::tools::{ToolDef, ToolResult};

mod types;
mod anthropic;
mod complete;
mod openai;

/// 可热更新的全局 HTTP 客户端（由「全局配置 · HTTP 代理」驱动）。
static HTTP_CLIENT: LazyLock<RwLock<Client>> =
    LazyLock::new(|| RwLock::new(build_http_client(false, "")));

fn build_http_client(use_proxy: bool, proxy_url: &str) -> Client {
    // 始终忽略环境变量代理，避免 IDE/VPN 残留 HTTP_PROXY 绑死进程
    let mut builder = Client::builder().no_proxy();

    let url = proxy_url.trim();
    if use_proxy && !url.is_empty() {
        match Proxy::all(url) {
            Ok(proxy) => {
                log::info!(
                    target: "chatcms_lib::provider",
                    "http client: custom proxy {url}"
                );
                builder = builder.proxy(proxy);
            }
            Err(e) => {
                log::warn!(
                    target: "chatcms_lib::provider",
                    "invalid proxy url {url:?}: {e}; fallback to direct"
                );
            }
        }
    } else {
        log::info!(
            target: "chatcms_lib::provider",
            "http client: direct connect"
        );
    }

    builder.build().unwrap_or_else(|e| {
        log::warn!(
            target: "chatcms_lib::provider",
            "http client build failed ({e}), fallback to default"
        );
        Client::builder()
            .no_proxy()
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

/// 按全局配置重建 Provider HTTP 客户端（保存设置后立即生效）。
pub fn configure_http_client(use_proxy: bool, proxy_url: &str) {
    let client = build_http_client(use_proxy, proxy_url);
    match HTTP_CLIENT.write() {
        Ok(mut slot) => *slot = client,
        Err(poisoned) => {
            *poisoned.into_inner() = client;
        }
    }
}

pub(super) fn http_client() -> Client {
    HTTP_CLIENT
        .read()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
}

pub use types::{
    ProviderOutput, StreamChunk, ThinkingChunk, TokenUsageEvent, ToolCallEvent, ToolResultEvent,
};
pub use anthropic::messages_to_anthropic;
pub use complete::complete_chat;
pub use openai::messages_to_openai;

// ── Public entry point ────────────────────────────────────────────────────────

pub async fn stream_chat(
    app: tauri::AppHandle,
    profile: &crate::models::ProviderProfile,
    session_id: String,
    api_messages: Vec<Value>,
    tools: Vec<ToolDef>,
    system_prompt: Option<String>,
    timing: Option<&mut crate::chat::trace::StreamTiming>,
) -> Result<ProviderOutput> {
    if profile.api_key.trim().is_empty() {
        bail!("API Key 未配置，请先在 Models 设置中填写后重试");
    }
    match profile.kind.as_str() {
        "anthropic" => {
            anthropic::stream_anthropic(
                app,
                profile,
                session_id,
                api_messages,
                tools,
                system_prompt,
                timing,
            )
            .await
        }
        _ => {
            openai::stream_openai(
                app,
                profile,
                session_id,
                api_messages,
                tools,
                system_prompt,
                timing,
            )
            .await
        }
    }
}

/// 将「助手工具调用 + 工具结果」编码为当前协议的 API messages。
pub fn encode_tool_turn(kind: &str, output: &ProviderOutput, results: &[ToolResult]) -> Vec<Value> {
    match kind {
        "anthropic" => anthropic::encode_tool_turn_anthropic(output, results),
        _ => openai::encode_tool_turn_openai(output, results),
    }
}
