//! chatcms-video 客户端：配置、HTTP 转发、成片入库。

pub mod commands;

use anyhow::{bail, Context, Result};
use base64::Engine;
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::AppHandle;

use crate::persist;
use crate::videos::{self, GeneratedVideo};

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:6060";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MptConfig {
    /// chatcms-video FastAPI 根地址，例如 http://127.0.0.1:6060
    pub base_url: String,
}

impl Default for MptConfig {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MptMaterialInfo {
    #[serde(default = "default_material_provider")]
    pub provider: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub duration: i32,
}

fn default_material_provider() -> String {
    "local".into()
}

/// 对齐 chatcms-video `VideoParams`（TaskVideoRequest）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MptVideoParams {
    pub video_subject: String,
    #[serde(default)]
    pub video_script: String,
    #[serde(default)]
    pub video_terms: Option<Value>,
    #[serde(default = "default_aspect")]
    pub video_aspect: String,
    #[serde(default = "default_concat")]
    pub video_concat_mode: String,
    #[serde(default)]
    pub video_transition_mode: Option<String>,
    #[serde(default = "default_clip_duration")]
    pub video_clip_duration: i32,
    #[serde(default = "default_video_count")]
    pub video_count: i32,
    #[serde(default = "default_source")]
    pub video_source: String,
    #[serde(default)]
    pub video_materials: Option<Vec<MptMaterialInfo>>,
    #[serde(default)]
    pub custom_audio_file: Option<String>,
    #[serde(default)]
    pub video_language: String,
    #[serde(default = "default_voice")]
    pub voice_name: String,
    #[serde(default = "default_voice_volume")]
    pub voice_volume: f64,
    #[serde(default = "default_voice_rate")]
    pub voice_rate: f64,
    #[serde(default = "default_bgm_type")]
    pub bgm_type: String,
    #[serde(default)]
    pub bgm_file: String,
    #[serde(default = "default_bgm_volume")]
    pub bgm_volume: f64,
    #[serde(default = "default_true")]
    pub subtitle_enabled: bool,
    #[serde(default = "default_subtitle_position")]
    pub subtitle_position: String,
    #[serde(default = "default_custom_position")]
    pub custom_position: f64,
    #[serde(default = "default_font_name")]
    pub font_name: String,
    #[serde(default = "default_text_fore_color")]
    pub text_fore_color: String,
    /// bool | string（颜色）
    #[serde(default = "default_text_bg")]
    pub text_background_color: Value,
    #[serde(default)]
    pub rounded_subtitle_background: bool,
    #[serde(default = "default_font_size")]
    pub font_size: i32,
    #[serde(default = "default_stroke_color")]
    pub stroke_color: String,
    #[serde(default = "default_stroke_width")]
    pub stroke_width: f64,
    #[serde(default = "default_paragraph_number")]
    pub paragraph_number: i32,
    #[serde(default)]
    pub video_script_prompt: String,
    #[serde(default)]
    pub custom_system_prompt: String,
}

fn default_aspect() -> String {
    "9:16".into()
}
fn default_concat() -> String {
    "random".into()
}
fn default_clip_duration() -> i32 {
    5
}
fn default_video_count() -> i32 {
    1
}
fn default_source() -> String {
    "pexels".into()
}
fn default_voice() -> String {
    "zh-CN-XiaoxiaoNeural-Female".into()
}
fn default_voice_volume() -> f64 {
    1.0
}
fn default_voice_rate() -> f64 {
    1.0
}
fn default_bgm_type() -> String {
    "random".into()
}
fn default_bgm_volume() -> f64 {
    0.2
}
fn default_true() -> bool {
    true
}
fn default_subtitle_position() -> String {
    "bottom".into()
}
fn default_custom_position() -> f64 {
    70.0
}
fn default_font_name() -> String {
    "MicrosoftYaHeiBold.ttc".into()
}
fn default_text_fore_color() -> String {
    "#FFFFFF".into()
}
fn default_text_bg() -> Value {
    Value::Bool(true)
}
fn default_font_size() -> i32 {
    60
}
fn default_stroke_color() -> String {
    "#000000".into()
}
fn default_stroke_width() -> f64 {
    1.5
}
fn default_paragraph_number() -> i32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MptTaskStatus {
    pub task_id: String,
    pub state: i32,
    pub progress: i32,
    pub videos: Vec<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MptFileItem {
    pub name: String,
    pub size: u64,
    pub file: String,
}

fn normalize_base(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

pub fn load_config(app: &AppHandle) -> MptConfig {
    persist::load_mpt_config(app)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_config(app: &AppHandle, config: &MptConfig) {
    let mut cfg = config.clone();
    cfg.base_url = normalize_base(&cfg.base_url);
    if cfg.base_url.is_empty() {
        cfg.base_url = DEFAULT_BASE_URL.to_string();
    }
    if let Ok(val) = serde_json::to_value(&cfg) {
        persist::save_mpt_config(app, &val);
    }
}

fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .unwrap_or_else(|_| Client::new())
}

async fn parse_api_response(status: reqwest::StatusCode, text: String, label: &str) -> Result<Value> {
    if !status.is_success() {
        bail!("chatcms-video 返回错误 ({status}): {text}");
    }
    // /ping 等可能返回纯文本
    if text.trim() == "pong" {
        return Ok(Value::String("pong".into()));
    }
    let value: Value =
        serde_json::from_str(&text).with_context(|| format!("chatcms-video 响应解析失败 ({label}): {text}"))?;
    let api_status = value.get("status").and_then(|v| v.as_i64()).unwrap_or(200);
    if api_status != 200 {
        let msg = value
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        bail!("chatcms-video 业务错误 ({api_status}): {msg}");
    }
    Ok(value.get("data").cloned().unwrap_or(Value::Null))
}

async fn mpt_request(
    method: reqwest::Method,
    base: &str,
    path: &str,
    body: Option<Value>,
) -> Result<Value> {
    let url = if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else if path.starts_with("/api/") || path == "/ping" {
        format!("{}{}", normalize_base(base), path)
    } else {
        format!("{}/api/v1{}", normalize_base(base), path)
    };
    let mut req = client().request(method.clone(), &url);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req
        .send()
        .await
        .with_context(|| format!("请求 chatcms-video 失败: {method} {url}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    parse_api_response(status, text, &url).await
}

async fn mpt_post(base: &str, path: &str, body: Value) -> Result<Value> {
    mpt_request(reqwest::Method::POST, base, path, Some(body)).await
}

async fn mpt_get(base: &str, path: &str) -> Result<Value> {
    mpt_request(reqwest::Method::GET, base, path, None).await
}

async fn mpt_put(base: &str, path: &str, body: Value) -> Result<Value> {
    mpt_request(reqwest::Method::PUT, base, path, Some(body)).await
}

async fn mpt_upload(base: &str, path: &str, data_base64: &str, filename: &str) -> Result<Value> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.trim())
        .context("Base64 解码失败")?;
    let name = filename.trim();
    if name.is_empty() {
        bail!("文件名不能为空");
    }
    let mime = guess_mime(name);
    let part = Part::bytes(bytes)
        .file_name(name.to_string())
        .mime_str(mime)
        .context("构造 multipart 失败")?;
    let form = Form::new().part("file", part);
    let url = format!("{}/api/v1{}", normalize_base(base), path);
    let resp = client()
        .post(&url)
        .multipart(form)
        .send()
        .await
        .with_context(|| format!("上传失败: POST {url}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    parse_api_response(status, text, &url).await
}

fn guess_mime(filename: &str) -> &'static str {
    let lower = filename.to_lowercase();
    if lower.ends_with(".mp3") {
        "audio/mpeg"
    } else if lower.ends_with(".wav") {
        "audio/wav"
    } else if lower.ends_with(".m4a") {
        "audio/mp4"
    } else if lower.ends_with(".aac") {
        "audio/aac"
    } else if lower.ends_with(".flac") {
        "audio/flac"
    } else if lower.ends_with(".ogg") {
        "audio/ogg"
    } else if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".mov") {
        "video/quicktime"
    } else if lower.ends_with(".webm") {
        "video/webm"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    }
}

pub async fn health_check(app: &AppHandle) -> Result<String> {
    let cfg = load_config(app);
    let base = normalize_base(&cfg.base_url);
    // meta/options 始终可用；比 /docs 更稳妥
    let _ = mpt_get(&base, "/meta/options").await?;
    Ok(base)
}

pub async fn meta_options(app: &AppHandle) -> Result<Value> {
    let cfg = load_config(app);
    mpt_get(&cfg.base_url, "/meta/options").await
}

pub async fn meta_voices(app: &AppHandle, tts_server: String) -> Result<Value> {
    let cfg = load_config(app);
    let server = if tts_server.trim().is_empty() {
        "azure-tts-v1".to_string()
    } else {
        tts_server.trim().to_string()
    };
    let encoded = urlencoding_encode(&server);
    mpt_get(&cfg.base_url, &format!("/meta/voices?tts_server={encoded}")).await
}

fn urlencoding_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

pub async fn voice_preview(
    app: &AppHandle,
    text: String,
    voice_name: String,
    voice_rate: f64,
    voice_volume: f64,
) -> Result<String> {
    let cfg = load_config(app);
    let data = mpt_post(
        &cfg.base_url,
        "/meta/voice-preview",
        json!({
            "text": text,
            "voice_name": voice_name,
            "voice_rate": voice_rate,
            "voice_volume": voice_volume,
        }),
    )
    .await?;
    data.get("data_base64")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .filter(|s| !s.is_empty())
        .context("chatcms-video 未返回试听音频")
}

pub async fn studio_config_get(app: &AppHandle) -> Result<Value> {
    let cfg = load_config(app);
    mpt_get(&cfg.base_url, "/config/studio").await
}

pub async fn studio_config_set(app: &AppHandle, partial: Value) -> Result<Value> {
    let cfg = load_config(app);
    mpt_put(&cfg.base_url, "/config/studio", partial).await
}

pub async fn generate_script(
    app: &AppHandle,
    video_subject: String,
    video_language: String,
    paragraph_number: i32,
    video_script_prompt: String,
    custom_system_prompt: String,
) -> Result<String> {
    let cfg = load_config(app);
    let data = mpt_post(
        &cfg.base_url,
        "/scripts",
        json!({
            "video_subject": video_subject,
            "video_language": video_language,
            "paragraph_number": paragraph_number.max(1).min(10),
            "video_script_prompt": video_script_prompt,
            "custom_system_prompt": custom_system_prompt,
        }),
    )
    .await?;
    data.get("video_script")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .filter(|s| !s.is_empty())
        .context("chatcms-video 未返回文案")
}

pub async fn generate_terms(
    app: &AppHandle,
    video_subject: String,
    video_script: String,
    amount: i32,
) -> Result<Vec<String>> {
    let cfg = load_config(app);
    let data = mpt_post(
        &cfg.base_url,
        "/terms",
        json!({
            "video_subject": video_subject,
            "video_script": video_script,
            "amount": amount.max(1).min(20),
        }),
    )
    .await?;
    let terms = data.get("video_terms").cloned().unwrap_or(Value::Null);
    match terms {
        Value::Array(arr) => Ok(arr
            .into_iter()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect()),
        Value::String(s) => Ok(s
            .split(|c| c == ',' || c == '，')
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect()),
        _ => bail!("chatcms-video 未返回关键词"),
    }
}

fn clean_video_params(mut params: MptVideoParams) -> MptVideoParams {
    if let Some(mode) = params.video_transition_mode.as_ref() {
        if mode.trim().is_empty() {
            params.video_transition_mode = None;
        }
    }
    if let Some(audio) = params.custom_audio_file.as_ref() {
        if audio.trim().is_empty() {
            params.custom_audio_file = None;
        }
    }
    if let Some(mats) = params.video_materials.as_ref() {
        if mats.is_empty() {
            params.video_materials = None;
        }
    }
    params
}

pub async fn create_video(app: &AppHandle, params: MptVideoParams) -> Result<String> {
    let params = clean_video_params(params);
    let subject = params.video_subject.trim().to_string();
    if subject.is_empty() && params.video_script.trim().is_empty() {
        bail!("请填写视频主题或文案");
    }
    let cfg = load_config(app);
    let body = serde_json::to_value(&params).context("序列化参数失败")?;
    let data = mpt_post(&cfg.base_url, "/videos", body).await?;
    data.get("task_id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .context("chatcms-video 未返回 task_id")
}

pub async fn get_task(app: &AppHandle, task_id: &str) -> Result<MptTaskStatus> {
    let cfg = load_config(app);
    let data = mpt_get(&cfg.base_url, &format!("/tasks/{task_id}")).await?;
    let state = data.get("state").and_then(|v| v.as_i64()).unwrap_or(4) as i32;
    let progress = data.get("progress").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let videos = data
        .get("videos")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();
    let message = data
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Ok(MptTaskStatus {
        task_id: task_id.to_string(),
        state,
        progress,
        videos,
        message,
    })
}

fn resolve_video_url(base: &str, url: &str) -> String {
    let url = url.trim();
    if url.starts_with("http://") || url.starts_with("https://") {
        return url.to_string();
    }
    let base = normalize_base(base);
    if url.starts_with('/') {
        format!("{base}{url}")
    } else {
        format!("{base}/{url}")
    }
}

pub async fn import_video_url(
    app: &AppHandle,
    video_url: &str,
    title: &str,
    task_id: Option<&str>,
) -> Result<GeneratedVideo> {
    let cfg = load_config(app);
    let full = resolve_video_url(&cfg.base_url, video_url);
    let resp = client()
        .get(&full)
        .send()
        .await
        .with_context(|| format!("下载成片失败: {full}"))?;
    let status = resp.status();
    if !status.is_success() {
        let t = resp.text().await.unwrap_or_default();
        bail!("下载成片失败 ({status}): {t}");
    }
    let bytes = resp.bytes().await.context("读取成片失败")?.to_vec();
    let mut record = videos::import_bytes(
        app,
        bytes,
        "video/mp4",
        full.as_str(),
        Some(title),
        "chatcms-video",
    )
    .await?;
    if let Some(tid) = task_id {
        record.remote_id = Some(tid.to_string());
        record.updated_at = record.created_at;
        persist::save_video(app, &record).await;
    }
    Ok(record)
}

fn parse_file_list(data: Value) -> Result<Vec<MptFileItem>> {
    let files = data
        .get("files")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for f in files {
        let name = f
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let file = f
            .get("file")
            .and_then(|v| v.as_str())
            .unwrap_or(name.as_str())
            .to_string();
        let size = f.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
        if !file.is_empty() {
            out.push(MptFileItem {
                name: if name.is_empty() {
                    file.clone()
                } else {
                    name
                },
                size,
                file,
            });
        }
    }
    Ok(out)
}

pub async fn list_bgm(app: &AppHandle) -> Result<Vec<MptFileItem>> {
    let cfg = load_config(app);
    let data = mpt_get(&cfg.base_url, "/musics").await?;
    parse_file_list(data)
}

pub async fn upload_bgm(
    app: &AppHandle,
    data_base64: String,
    filename: String,
) -> Result<String> {
    let cfg = load_config(app);
    let data = mpt_upload(&cfg.base_url, "/musics", &data_base64, &filename).await?;
    data.get("file")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .context("上传 BGM 未返回文件名")
}

pub async fn list_materials(app: &AppHandle) -> Result<Vec<MptFileItem>> {
    let cfg = load_config(app);
    let data = mpt_get(&cfg.base_url, "/video_materials").await?;
    parse_file_list(data)
}

pub async fn upload_material(
    app: &AppHandle,
    data_base64: String,
    filename: String,
) -> Result<String> {
    let cfg = load_config(app);
    let data = mpt_upload(&cfg.base_url, "/video_materials", &data_base64, &filename).await?;
    data.get("file")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .context("上传素材未返回文件名")
}

pub async fn upload_custom_audio(
    app: &AppHandle,
    data_base64: String,
    filename: String,
) -> Result<String> {
    let cfg = load_config(app);
    let data = mpt_upload(&cfg.base_url, "/custom_audios", &data_base64, &filename).await?;
    data.get("file")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .context("上传旁白音频未返回文件名")
}
