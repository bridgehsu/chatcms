//! AI 生图：OpenAI 兼容 `/v1/images/generations`，结果落盘并记入 store。

use anyhow::{bail, Context, Result};
use base64::Engine;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::config::{AppConfig, ProviderKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedImage {
    pub id: String,
    pub prompt: String,
    pub model: String,
    pub size: String,
    /// 绝对路径
    pub path: String,
    pub created_at: i64,
}

#[derive(Deserialize)]
struct ImagesResponse {
    data: Vec<ImageData>,
}

#[derive(Deserialize)]
struct ImageData {
    b64_json: Option<String>,
    url: Option<String>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn images_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .context("无法获取应用数据目录")?
        .join("images");
    fs::create_dir_all(&dir).context("创建图片目录失败")?;
    Ok(dir)
}

fn resolve_images_endpoint(config: &AppConfig) -> Result<(String, String)> {
    let key = config.provider.api_key.trim();
    if key.is_empty() {
        bail!("API Key 未配置，请先到「模型配置」填写密钥");
    }

    let base = config
        .provider
        .base_url
        .as_deref()
        .unwrap_or("")
        .trim()
        .trim_end_matches('/');

    // Anthropic 官方地址不支持 images API
    if matches!(config.provider.kind, ProviderKind::Anthropic)
        && (base.is_empty() || base.contains("anthropic.com"))
    {
        bail!("当前模型为 Anthropic，不支持生图。请切换到 OpenAI 兼容配置（如 GPT / 通义 / DeepSeek 等带图像接口的服务）");
    }

    let endpoint = if base.is_empty() {
        "https://api.openai.com/v1/images/generations".to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/images/generations")
    } else if base.contains("/v1/") {
        // e.g. .../compatible-mode/v1 → replace last path
        format!("{}/images/generations", base.trim_end_matches('/'))
    } else {
        format!("{base}/v1/images/generations")
    };

    Ok((endpoint, key.to_string()))
}

pub async fn generate(
    app: &AppHandle,
    config: AppConfig,
    prompt: String,
    model: String,
    size: String,
) -> Result<GeneratedImage> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        bail!("请填写图片描述");
    }

    let model = if model.trim().is_empty() {
        "dall-e-3".to_string()
    } else {
        model.trim().to_string()
    };
    let size = if size.trim().is_empty() {
        "1024x1024".to_string()
    } else {
        size.trim().to_string()
    };

    let (endpoint, api_key) = resolve_images_endpoint(&config)?;
    let client = Client::new();

    let body = json!({
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "response_format": "b64_json",
    });

    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .context("生图请求失败")?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        bail!("生图失败 ({status}): {text}");
    }

    let parsed: ImagesResponse =
        serde_json::from_str(&text).context(format!("生图响应解析失败: {text}"))?;
    let item = parsed
        .data
        .into_iter()
        .next()
        .context("生图响应为空")?;

    let bytes = if let Some(b64) = item.b64_json {
        base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .context("图片 Base64 解码失败")?
    } else if let Some(url) = item.url {
        let bin = client
            .get(&url)
            .send()
            .await
            .context("下载生成图片失败")?
            .bytes()
            .await
            .context("读取图片内容失败")?;
        bin.to_vec()
    } else {
        bail!("生图响应缺少 b64_json / url");
    };

    let id = Uuid::new_v4().to_string();
    let path = images_dir(app)?.join(format!("{id}.png"));
    fs::write(&path, &bytes).context("保存图片失败")?;

    let record = GeneratedImage {
        id,
        prompt,
        model,
        size,
        path: path.to_string_lossy().to_string(),
        created_at: now_ms(),
    };

    let mut list = crate::persist::load_images(app);
    list.insert(0, record.clone());
    crate::persist::save_images(app, &list);

    Ok(record)
}

pub fn list(app: &AppHandle) -> Vec<GeneratedImage> {
    crate::persist::load_images(app)
}

pub fn delete(app: &AppHandle, id: String) -> Result<()> {
    let mut list = crate::persist::load_images(app);
    if let Some(pos) = list.iter().position(|i| i.id == id) {
        let item = list.remove(pos);
        let _ = fs::remove_file(&item.path);
        crate::persist::save_images(app, &list);
        Ok(())
    } else {
        bail!("图片不存在");
    }
}

/// 读取本地图片为 data URL，供前端展示（避免资产协议配置）
pub fn read_data_url(path: String) -> Result<String> {
    let bytes = fs::read(&path).context("读取图片失败")?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    let lower = path.to_lowercase();
    let mime = if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else {
        "image/png"
    };
    Ok(format!("data:{mime};base64,{b64}"))
}
