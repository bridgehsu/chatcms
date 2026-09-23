//! 一次性文本补全（无 tools、不 emit 流式事件）

use anyhow::{bail, Result};
use serde_json::{json, Value};

use super::http_client;

/// 强制关闭思考，避免总结/改稿任务拖慢或夹杂 reasoning。
fn profile_for_complete(profile: &crate::models::ProviderProfile) -> crate::models::ProviderProfile {
    let mut p = profile.clone();
    p.thinking = false;
    p
}

pub async fn complete_chat(
    profile: &crate::models::ProviderProfile,
    user_content: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    if profile.api_key.trim().is_empty() {
        bail!("API Key 未配置，请先在 Models 设置中填写后重试");
    }
    let profile = profile_for_complete(profile);
    match profile.kind.as_str() {
        "anthropic" => complete_anthropic(&profile, user_content, system_prompt).await,
        _ => complete_openai(&profile, user_content, system_prompt).await,
    }
}

async fn complete_openai(
    profile: &crate::models::ProviderProfile,
    user_content: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let client = http_client();
    let base_url = profile
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com".to_string());
    let base_url = base_url
        .trim_end_matches('/')
        .trim_end_matches("/v1")
        .to_string();
    let url = format!("{}/v1/chat/completions", base_url);

    let mut messages: Vec<Value> = Vec::new();
    if let Some(sys) = system_prompt.filter(|s| !s.is_empty()) {
        messages.push(json!({ "role": "system", "content": sys }));
    }
    messages.push(json!({ "role": "user", "content": user_content }));

    let mut body = json!({
        "model": profile.model,
        "stream": false,
        "messages": messages,
    });
    if let Some(temp) = profile.temperature {
        body["temperature"] = json!(temp);
    }
    if let Some(max_tok) = profile.max_output_tokens {
        body["max_tokens"] = json!(max_tok);
    } else {
        body["max_tokens"] = json!(4096);
    }
    if let Some(obj) = profile.extra_body.as_object() {
        for (k, v) in obj {
            body[k.as_str()] = v.clone();
        }
    }
    // 关闭思考（与 stream 路径一致）
    body["think"] = json!(false);
    body["enable_thinking"] = json!(false);
    body["reasoning_effort"] = json!("none");
    body["chat_template_kwargs"] = json!({ "enable_thinking": false });

    let resp = client
        .post(&url)
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

    let val: Value = resp.json().await?;
    let text = val["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();
    if text.is_empty() {
        bail!("模型返回为空");
    }
    Ok(strip_think_tags(&text))
}

async fn complete_anthropic(
    profile: &crate::models::ProviderProfile,
    user_content: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let client = http_client();
    let base_url = profile
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.anthropic.com".to_string());
    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));

    let mut body = json!({
        "model": profile.model,
        "max_tokens": profile.max_output_tokens.unwrap_or(4096),
        "messages": [{ "role": "user", "content": user_content }],
    });
    if let Some(sys) = system_prompt.filter(|s| !s.is_empty()) {
        body["system"] = json!(sys);
    }
    if let Some(temp) = profile.temperature {
        body["temperature"] = json!(temp);
    }
    if let Some(obj) = profile.extra_body.as_object() {
        for (k, v) in obj {
            body[k.as_str()] = v.clone();
        }
    }

    let resp = client
        .post(&url)
        .header("x-api-key", &profile.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        bail!("Anthropic API 错误 ({status}): {err_body}");
    }

    let val: Value = resp.json().await?;
    let mut text = String::new();
    if let Some(arr) = val["content"].as_array() {
        for block in arr {
            if block["type"].as_str() == Some("text") {
                if let Some(t) = block["text"].as_str() {
                    text.push_str(t);
                }
            }
        }
    }
    let text = text.trim().to_string();
    if text.is_empty() {
        bail!("模型返回为空");
    }
    Ok(text)
}

fn strip_think_tags(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    while let Some(start) = rest.find("<think>") {
        out.push_str(&rest[..start]);
        if let Some(end) = rest[start..].find("</think>") {
            rest = &rest[start + end + "</think>".len()..];
        } else {
            rest = "";
            break;
        }
    }
    out.push_str(rest);
    out.trim().to_string()
}
