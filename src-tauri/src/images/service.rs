use anyhow::{bail, Context, Result};
use base64::Engine;
use reqwest::Client;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use uuid::Uuid;

use super::GeneratedImage;
use crate::common::config::{AppConfig, ProviderKind};
use super::repository as repo;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn images_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = crate::common::config::resolve_data_root(app).join("images");
    fs::create_dir_all(&dir).context("创建图片目录失败")?;
    Ok(dir)
}

/// 图片用途下的协议：openai（Images API）| dashscope（通义多模态）
fn normalize_image_kind(kind: &str) -> &'static str {
    match kind.trim().to_ascii_lowercase().as_str() {
        "dashscope" | "qwen" => "dashscope",
        _ => "openai",
    }
}

fn require_api_key(api_key: &str) -> Result<String> {
    let key = api_key.trim();
    if key.is_empty() {
        bail!("该模型配置未填写 API Key，请先到「模型配置」补全");
    }
    Ok(key.to_string())
}

fn resolve_openai_images_endpoint(kind: &str, base_url: Option<&str>) -> Result<String> {
    let base = base_url.unwrap_or("").trim().trim_end_matches('/');

    if kind.eq_ignore_ascii_case("anthropic")
        && (base.is_empty() || base.contains("anthropic.com"))
    {
        bail!("Anthropic 配置不支持生图。请选择 OpenAI 兼容或 DashScope 协议的图片模型");
    }

    Ok(if base.is_empty() {
        "https://api.openai.com/v1/images/generations".to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/images/generations")
    } else if base.contains("/v1/") {
        format!("{}/images/generations", base.trim_end_matches('/'))
    } else {
        format!("{base}/v1/images/generations")
    })
}

fn resolve_dashscope_endpoint(base_url: Option<&str>) -> String {
    const PATH: &str = "/api/v1/services/aigc/multimodal-generation/generation";
    let base = base_url.unwrap_or("").trim().trim_end_matches('/');
    if base.is_empty() {
        return format!("https://dashscope.aliyuncs.com{PATH}");
    }
    if base.ends_with("/generation") || base.contains("/multimodal-generation/") {
        return base.to_string();
    }
    format!("{base}{PATH}")
}

/// UI 用 `1024x1024`；DashScope 参数用 `1024*1024`
fn to_dashscope_size(size: &str) -> String {
    let s = size.trim();
    if s.is_empty() {
        return "1024*1024".into();
    }
    s.replace('×', "*")
        .replace('x', "*")
        .replace('X', "*")
}

/// 兼容旧调用：用当前激活的 AppConfig.provider
pub async fn generate(
    app: &AppHandle,
    config: AppConfig,
    prompt: String,
    model: String,
    size: String,
) -> Result<GeneratedImage> {
    generate_with_credentials(
        app,
        config.provider.api_key.clone(),
        config.provider.base_url.clone(),
        match config.provider.kind {
            ProviderKind::Anthropic => "anthropic".into(),
            ProviderKind::OpenAI => "openai".into(),
        },
        prompt,
        model,
        size,
    )
    .await
}

/// 使用指定模型配置档案生图（图片工厂主路径）
pub async fn generate_with_profile(
    app: &AppHandle,
    profile: &crate::models::ProviderProfile,
    prompt: String,
    size: String,
) -> Result<GeneratedImage> {
    generate_with_credentials(
        app,
        profile.api_key.clone(),
        profile.base_url.clone(),
        profile.kind.clone(),
        prompt,
        profile.model.clone(),
        size,
    )
    .await
}

async fn generate_with_credentials(
    app: &AppHandle,
    api_key: String,
    base_url: Option<String>,
    kind: String,
    prompt: String,
    model: String,
    size: String,
) -> Result<GeneratedImage> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        bail!("请填写图片描述");
    }

    let protocol = normalize_image_kind(&kind);
    let model = if model.trim().is_empty() {
        match protocol {
            "dashscope" => "qwen-image-3.0-pro".to_string(),
            _ => "dall-e-3".to_string(),
        }
    } else {
        model.trim().to_string()
    };
    let size = if size.trim().is_empty() {
        "1024x1024".to_string()
    } else {
        size.trim().to_string()
    };

    let api_key = require_api_key(&api_key)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .context("创建 HTTP 客户端失败")?;

    let bytes = match protocol {
        "dashscope" => {
            generate_dashscope(&client, &api_key, base_url.as_deref(), &model, &prompt, &size)
                .await?
        }
        _ => {
            generate_openai(
                &client,
                &api_key,
                &kind,
                base_url.as_deref(),
                &model,
                &prompt,
                &size,
            )
            .await?
        }
    };

    persist_generated(app, bytes, prompt, model, size).await
}

async fn generate_openai(
    client: &Client,
    api_key: &str,
    kind: &str,
    base_url: Option<&str>,
    model: &str,
    prompt: &str,
    size: &str,
) -> Result<Vec<u8>> {
    let endpoint = resolve_openai_images_endpoint(kind, base_url)?;
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

    #[derive(serde::Deserialize)]
    struct ImagesResponse {
        data: Vec<ImageData>,
    }
    #[derive(serde::Deserialize)]
    struct ImageData {
        b64_json: Option<String>,
        url: Option<String>,
    }

    let parsed: ImagesResponse =
        serde_json::from_str(&text).context(format!("生图响应解析失败: {text}"))?;
    let item = parsed.data.into_iter().next().context("生图响应为空")?;

    if let Some(b64) = item.b64_json {
        base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .context("图片 Base64 解码失败")
    } else if let Some(url) = item.url {
        download_image_bytes(client, &url).await
    } else {
        bail!("生图响应缺少 b64_json / url");
    }
}

async fn generate_dashscope(
    client: &Client,
    api_key: &str,
    base_url: Option<&str>,
    model: &str,
    prompt: &str,
    size: &str,
) -> Result<Vec<u8>> {
    let endpoint = resolve_dashscope_endpoint(base_url);
    let body = json!({
        "model": model,
        "input": {
            "messages": [{
                "role": "user",
                "content": [{ "text": prompt }]
            }]
        },
        "parameters": {
            "prompt_extend": true,
            "size": to_dashscope_size(size),
            "n": 1
        }
    });

    let resp = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .context("DashScope 生图请求失败")?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        bail!("DashScope 生图失败 ({status}): {text}");
    }

    let parsed: Value =
        serde_json::from_str(&text).context(format!("DashScope 响应解析失败: {text}"))?;

    if let Some(code) = parsed.get("code").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        let msg = parsed
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("未知错误");
        bail!("DashScope 生图失败 ({code}): {msg}");
    }

    let image_url = extract_dashscope_image_url(&parsed)
        .with_context(|| format!("DashScope 响应中未找到图片 URL: {text}"))?;

    download_image_bytes(client, &image_url).await
}

fn extract_dashscope_image_url(parsed: &Value) -> Option<String> {
    let content = parsed
        .pointer("/output/choices/0/message/content")
        .and_then(|v| v.as_array())?;
    for item in content {
        if let Some(url) = item.get("image").and_then(|v| v.as_str()) {
            let url = url.trim();
            if !url.is_empty() {
                return Some(url.to_string());
            }
        }
    }
    None
}

async fn download_image_bytes(client: &Client, url: &str) -> Result<Vec<u8>> {
    let bin = client
        .get(url)
        .send()
        .await
        .context("下载生成图片失败")?
        .bytes()
        .await
        .context("读取图片内容失败")?;
    Ok(bin.to_vec())
}

async fn persist_generated(
    app: &AppHandle,
    bytes: Vec<u8>,
    prompt: String,
    model: String,
    size: String,
) -> Result<GeneratedImage> {
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
        created: ts,
        remark: String::new(),
        updated: ts,
    };

    repo::save(app, &record).await;
    Ok(record)
}

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
        created: ts,
        remark: String::new(),
        updated: ts,
    };

    repo::save(app, &record).await;
    Ok(record)
}

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

pub async fn update(
    app: &AppHandle,
    id: String,
    title: String,
    remark: String,
) -> Result<GeneratedImage> {
    let title = title.trim().to_string();
    if title.is_empty() {
        bail!("名称不能为空");
    }
    let remark = remark.chars().take(500).collect::<String>();
    let mut images = repo::load_all(app).await;
    let Some(item) = images.iter_mut().find(|i| i.id == id) else {
        bail!("图片不存在");
    };
    item.prompt = title.chars().take(200).collect();
    item.remark = remark;
    item.updated = now_ms();
    let updated = item.clone();
    repo::save(app, &updated).await;
    Ok(updated)
}

pub async fn list(app: &AppHandle) -> Vec<GeneratedImage> {
    repo::load_all(app).await
}

pub async fn delete(app: &AppHandle, id: String) -> Result<()> {
    let images = repo::load_all(app).await;
    if let Some(item) = images.iter().find(|i| i.id == id) {
        let path = item.path.clone();
        repo::delete(app, &id).await;
        let _ = fs::remove_file(&path);
        Ok(())
    } else {
        bail!("图片不存在");
    }
}

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

fn looks_like_image(bytes: &[u8]) -> bool {
    if bytes.len() < 12 {
        return false;
    }
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
