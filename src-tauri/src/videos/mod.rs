//! AI 生视频：OpenAI Videos API（`/v1/videos`）异步任务 → 下载 MP4 落盘。

use anyhow::{bail, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tokio::time::sleep;
use uuid::Uuid;

use crate::config::{AppConfig, ProviderKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedVideo {
    pub id: String,
    pub prompt: String,
    pub model: String,
    pub size: String,
    pub seconds: String,
    /// 绝对路径（mp4）
    pub path: String,
    pub created_at: i64,
    /// 远端 job id（若有）
    pub remote_id: Option<String>,
}

#[derive(Deserialize)]
struct VideoJob {
    id: String,
    status: String,
    #[serde(default)]
    error: Option<VideoJobError>,
    #[serde(default)]
    progress: Option<f64>,
}

#[derive(Deserialize)]
struct VideoJobError {
    message: Option<String>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn videos_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .context("无法获取应用数据目录")?
        .join("videos");
    fs::create_dir_all(&dir).context("创建视频目录失败")?;
    Ok(dir)
}

fn resolve_videos_base(config: &AppConfig) -> Result<(String, String)> {
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

    if matches!(config.provider.kind, ProviderKind::Anthropic)
        && (base.is_empty() || base.contains("anthropic.com"))
    {
        bail!("当前模型为 Anthropic，不支持生视频。请切换到 OpenAI 兼容配置（如 sora-2）");
    }

    let api_base = if base.is_empty() {
        "https://api.openai.com/v1".to_string()
    } else if base.ends_with("/v1") {
        base.to_string()
    } else if base.contains("/v1/") {
        // keep as-is up to last /v1 segment roughly
        base.to_string()
    } else {
        format!("{base}/v1")
    };

    Ok((api_base, key.to_string()))
}

pub async fn generate(
    app: &AppHandle,
    config: AppConfig,
    prompt: String,
    model: String,
    size: String,
    seconds: String,
) -> Result<GeneratedVideo> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        bail!("请填写视频描述");
    }

    let model = if model.trim().is_empty() {
        "sora-2".to_string()
    } else {
        model.trim().to_string()
    };
    let size = if size.trim().is_empty() {
        "1280x720".to_string()
    } else {
        size.trim().to_string()
    };
    let seconds = match seconds.trim() {
        "4" | "8" | "12" => seconds.trim().to_string(),
        _ => "4".to_string(),
    };

    let (api_base, api_key) = resolve_videos_base(&config)?;
    let client = Client::new();
    let create_url = format!("{api_base}/videos");

    let body = json!({
        "model": model,
        "prompt": prompt,
        "size": size,
        "seconds": seconds,
    });

    let resp = client
        .post(&create_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .context("发起生视频请求失败")?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        bail!("生视频失败 ({status}): {text}");
    }

    // 兼容：部分网关直接返回 url / 同步结果
    if let Ok(immediate) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Some(url) = immediate
            .pointer("/data/0/url")
            .and_then(|v| v.as_str())
            .or_else(|| immediate.get("url").and_then(|v| v.as_str()))
        {
            return save_from_url(app, &client, url, prompt, model, size, seconds, None).await;
        }
    }

    let job: VideoJob =
        serde_json::from_str(&text).context(format!("生视频响应解析失败: {text}"))?;

    let remote_id = job.id.clone();
    let mut current = job;
    // 最长等待约 10 分钟
    for _ in 0..120 {
        match current.status.as_str() {
            "completed" => break,
            "failed" => {
                let msg = current
                    .error
                    .as_ref()
                    .and_then(|e| e.message.clone())
                    .unwrap_or_else(|| "未知错误".into());
                bail!("生视频任务失败: {msg}");
            }
            _ => {
                sleep(Duration::from_secs(5)).await;
                let poll_url = format!("{api_base}/videos/{remote_id}");
                let poll = client
                    .get(&poll_url)
                    .header("Authorization", format!("Bearer {api_key}"))
                    .send()
                    .await
                    .context("轮询生视频状态失败")?;
                let st = poll.status();
                let body = poll.text().await.unwrap_or_default();
                if !st.is_success() {
                    bail!("轮询失败 ({st}): {body}");
                }
                current = serde_json::from_str(&body)
                    .context(format!("轮询响应解析失败: {body}"))?;
            }
        }
    }

    if current.status != "completed" {
        bail!(
            "生视频超时（仍为 {}，进度 {:?}）",
            current.status,
            current.progress
        );
    }

    let content_url = format!("{api_base}/videos/{remote_id}/content");
    let bin = client
        .get(&content_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .send()
        .await
        .context("下载视频内容失败")?;
    let st = bin.status();
    if !st.is_success() {
        let t = bin.text().await.unwrap_or_default();
        bail!("下载视频失败 ({st}): {t}");
    }
    let bytes = bin.bytes().await.context("读取视频字节失败")?.to_vec();

    save_bytes(
        app,
        bytes,
        prompt,
        model,
        size,
        seconds,
        Some(remote_id),
    )
}

async fn save_from_url(
    app: &AppHandle,
    client: &Client,
    url: &str,
    prompt: String,
    model: String,
    size: String,
    seconds: String,
    remote_id: Option<String>,
) -> Result<GeneratedVideo> {
    let bin = client
        .get(url)
        .send()
        .await
        .context("下载视频失败")?
        .bytes()
        .await
        .context("读取视频失败")?
        .to_vec();
    save_bytes(app, bin, prompt, model, size, seconds, remote_id)
}

fn save_bytes(
    app: &AppHandle,
    bytes: Vec<u8>,
    prompt: String,
    model: String,
    size: String,
    seconds: String,
    remote_id: Option<String>,
) -> Result<GeneratedVideo> {
    let id = Uuid::new_v4().to_string();
    let path = videos_dir(app)?.join(format!("{id}.mp4"));
    fs::write(&path, &bytes).context("保存视频失败")?;

    let record = GeneratedVideo {
        id,
        prompt,
        model,
        size,
        seconds,
        path: path.to_string_lossy().to_string(),
        created_at: now_ms(),
        remote_id,
    };

    let mut list = crate::persist::load_videos(app);
    list.insert(0, record.clone());
    crate::persist::save_videos(app, &list);
    Ok(record)
}

pub fn list(app: &AppHandle) -> Vec<GeneratedVideo> {
    crate::persist::load_videos(app)
}

pub fn delete(app: &AppHandle, id: String) -> Result<()> {
    let mut list = crate::persist::load_videos(app);
    if let Some(pos) = list.iter().position(|i| i.id == id) {
        let item = list.remove(pos);
        let _ = fs::remove_file(&item.path);
        crate::persist::save_videos(app, &list);
        Ok(())
    } else {
        bail!("视频不存在");
    }
}
