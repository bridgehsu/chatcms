//! AI 生图：OpenAI 兼容 `/v1/images/generations`，结果落盘并记入 store。

pub mod commands;

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
    /// 备注
    #[serde(default)]
    pub note: String,
    /// 最近修改时间；旧数据缺省时为 0，前端回退 created_at
    #[serde(default)]
    pub updated_at: i64,
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

    let ts = now_ms();
    let record = GeneratedImage {
        id,
        prompt,
        model,
        size,
        path: path.to_string_lossy().to_string(),
        created_at: ts,
        note: String::new(),
        updated_at: ts,
    };

    crate::persist::save_image(app, &record).await;

    Ok(record)
}

/// 从网页 URL 下载并写入图片库（扩展「保存素材」）。
pub async fn import_from_url(
    app: &AppHandle,
    url: &str,
    page_url: Option<&str>,
    title: Option<&str>,
) -> Result<GeneratedImage> {
    const MAX_BYTES: usize = 20 * 1024 * 1024;
    let url = url.trim();
    if url.is_empty() {
        bail!("图片地址为空");
    }
    if url.starts_with("data:") || url.starts_with("blob:") {
        bail!("不支持 data/blob 地址");
    }

    let client = Client::new();
    let mut req = client.get(url);
    if let Some(referer) = page_url.map(str::trim).filter(|s| !s.is_empty()) {
        req = req.header("Referer", referer);
        if let Ok(origin) = reqwest::Url::parse(referer) {
            let origin = origin.origin().ascii_serialization();
            req = req.header("Origin", origin);
        }
    }
    req = req
        .header(
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8");

    let resp = req.send().await.context("下载图片失败")?;
    let status = resp.status();
    if !status.is_success() {
        bail!("下载图片失败 ({status})");
    }
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = resp.bytes().await.context("读取图片内容失败")?;
    if bytes.len() > MAX_BYTES {
        bail!("图片超过 20MB 上限");
    }
    import_bytes(app, bytes.to_vec(), &content_type, url, title, "web_import").await
}

/// 扩展已拉取 / 本机上传的字节直接入库。
pub async fn import_bytes(
    app: &AppHandle,
    bytes: Vec<u8>,
    content_type: &str,
    source_hint: &str,
    title: Option<&str>,
    model: &str,
) -> Result<GeneratedImage> {
    const MAX_BYTES: usize = 20 * 1024 * 1024;
    if bytes.is_empty() {
        bail!("图片内容为空");
    }
    if bytes.len() > MAX_BYTES {
        bail!("图片超过 20MB 上限");
    }
    let ct = content_type.to_lowercase();
    if ct.contains("text/html") || ct.contains("application/json") {
        bail!("地址返回的不是图片（可能被防盗链拦截）");
    }
    if !looks_like_image(&bytes) && !ct.starts_with("image/") {
        bail!("内容不是有效图片");
    }

    let ext = guess_image_ext(source_hint, content_type);
    let id = Uuid::new_v4().to_string();
    let path = images_dir(app)?.join(format!("{id}.{ext}"));
    fs::write(&path, &bytes).context("保存图片失败")?;

    let prompt = title
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(source_hint)
        .chars()
        .take(200)
        .collect::<String>();

    let model = if model.trim().is_empty() {
        "local_upload".to_string()
    } else {
        model.trim().to_string()
    };

    let ts = now_ms();
    let record = GeneratedImage {
        id,
        prompt,
        model,
        size: "imported".into(),
        path: path.to_string_lossy().to_string(),
        created_at: ts,
        note: String::new(),
        updated_at: ts,
    };

    crate::persist::save_image(app, &record).await;
    Ok(record)
}

/// 本机上传：base64 → 图片库。
pub async fn upload_base64(
    app: &AppHandle,
    data_base64: &str,
    filename: &str,
    content_type: Option<&str>,
) -> Result<GeneratedImage> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.trim())
        .context("图片 Base64 解码失败")?;
    let name = filename.trim();
    let title = if name.is_empty() { None } else { Some(name) };
    let ct = content_type.unwrap_or("").trim();
    let hint = if name.is_empty() { "upload.png" } else { name };
    import_bytes(app, bytes, ct, hint, title, "local_upload").await
}

/// 更新名称与备注。
pub async fn update(
    app: &AppHandle,
    id: String,
    title: String,
    note: String,
) -> Result<GeneratedImage> {
    let title = title.trim().to_string();
    if title.is_empty() {
        bail!("名称不能为空");
    }
    let note = note.chars().take(500).collect::<String>();
    let mut images = crate::persist::load_all_images(app).await;
    let Some(item) = images.iter_mut().find(|i| i.id == id) else {
        bail!("图片不存在");
    };
    item.prompt = title.chars().take(200).collect();
    item.note = note;
    item.updated_at = now_ms();
    let updated = item.clone();
    crate::persist::save_image(app, &updated).await;
    Ok(updated)
}

fn looks_like_image(bytes: &[u8]) -> bool {
    if bytes.len() < 12 {
        return false;
    }
    // JPEG / PNG / GIF / WEBP
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return true;
    }
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        return true;
    }
    if bytes.starts_with(b"GIF8") {
        return true;
    }
    if bytes.starts_with(b"RIFF") && bytes[8..12] == *b"WEBP" {
        return true;
    }
    false
}

fn guess_image_ext(url: &str, content_type: &str) -> &'static str {
    let ct = content_type.to_lowercase();
    if ct.contains("jpeg") || ct.contains("jpg") {
        return "jpg";
    }
    if ct.contains("webp") {
        return "webp";
    }
    if ct.contains("gif") {
        return "gif";
    }
    if ct.contains("png") {
        return "png";
    }
    let path = url.split('?').next().unwrap_or(url).to_lowercase();
    if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        return "jpg";
    }
    if path.ends_with(".webp") {
        return "webp";
    }
    if path.ends_with(".gif") {
        return "gif";
    }
    "png"
}

pub async fn list(app: &AppHandle) -> Vec<GeneratedImage> {
    crate::persist::load_all_images(app).await
}

pub async fn delete(app: &AppHandle, id: String) -> Result<()> {
    let images = crate::persist::load_all_images(app).await;
    if let Some(item) = images.iter().find(|i| i.id == id) {
        let path = item.path.clone();
        crate::persist::delete_image(app, &id).await;
        let _ = fs::remove_file(&path);
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
