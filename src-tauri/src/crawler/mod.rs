//! chatcms-collect HTTP 控制面客户端。
//! 采集中心通过 Base URL 调用 Worker：`/api/crawler/*`、`/api/data/*`、`/api/health`。

pub mod commands;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

use crate::persist;

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8080";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerConfig {
    /// chatcms-collect FastAPI 根地址，例如 http://127.0.0.1:8080
    pub base_url: String,
}

impl Default for CrawlerConfig {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerStartRequest {
    pub platform: String,
    #[serde(default = "default_login")]
    pub login_type: String,
    #[serde(default = "default_crawler_type")]
    pub crawler_type: String,
    #[serde(default)]
    pub keywords: String,
    #[serde(default)]
    pub specified_ids: String,
    #[serde(default)]
    pub creator_ids: String,
    #[serde(default = "default_start_page")]
    pub start_page: u32,
    #[serde(default = "default_true")]
    pub enable_comments: bool,
    #[serde(default)]
    pub enable_sub_comments: bool,
    #[serde(default = "default_save")]
    pub save_option: String,
    #[serde(default)]
    pub cookies: String,
    #[serde(default)]
    pub headless: bool,
    pub max_notes_count: Option<u32>,
    pub max_comments_count: Option<u32>,
}

fn default_login() -> String {
    "qrcode".into()
}
fn default_crawler_type() -> String {
    "search".into()
}
fn default_start_page() -> u32 {
    1
}
fn default_true() -> bool {
    true
}
fn default_save() -> String {
    "jsonl".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: u64,
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerStatus {
    pub status: String,
    pub platform: Option<String>,
    pub crawler_type: Option<String>,
    pub started_at: Option<String>,
    pub error_message: Option<String>,
    /// 当前连接的 Worker base_url（桌面端补充）
    #[serde(default)]
    pub base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified_at: f64,
    #[serde(default)]
    pub record_count: Option<u64>,
    #[serde(default)]
    pub r#type: Option<String>,
}

fn normalize_base(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| Client::new())
}

pub fn load_config(app: &AppHandle) -> CrawlerConfig {
    if let Some(v) = persist::load_crawler_config(app) {
        // 兼容旧配置：只有 project_root 时回落到默认 HTTP
        if let Ok(cfg) = serde_json::from_value::<CrawlerConfig>(v.clone()) {
            if !cfg.base_url.trim().is_empty() {
                return CrawlerConfig {
                    base_url: normalize_base(&cfg.base_url),
                };
            }
        }
        if let Some(url) = v.get("base_url").and_then(|x| x.as_str()) {
            if !url.trim().is_empty() {
                return CrawlerConfig {
                    base_url: normalize_base(url),
                };
            }
        }
    }
    CrawlerConfig::default()
}

pub fn save_config(app: &AppHandle, cfg: &CrawlerConfig) {
    let to_store = CrawlerConfig {
        base_url: normalize_base(&cfg.base_url),
    };
    if let Ok(v) = serde_json::to_value(&to_store) {
        persist::save_crawler_config(app, &v);
    }
}

async fn map_err(resp: reqwest::Response) -> String {
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if body.is_empty() {
        format!("HTTP {status}")
    } else {
        // FastAPI detail 可能是字符串或对象
        if let Ok(v) = serde_json::from_str::<Value>(&body) {
            if let Some(d) = v.get("detail") {
                return format!("HTTP {status}: {d}");
            }
        }
        format!("HTTP {status}: {body}")
    }
}

pub async fn health(app: &AppHandle) -> Result<String, String> {
    let cfg = load_config(app);
    let url = format!("{}/api/health", normalize_base(&cfg.base_url));
    let resp = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("无法连接 Worker ({url}): {e}"))?;
    if !resp.status().is_success() {
        return Err(map_err(resp).await);
    }
    let body = resp.text().await.unwrap_or_else(|_| "ok".into());
    Ok(format!("{} | {}", normalize_base(&cfg.base_url), body.trim()))
}

pub async fn start(app: &AppHandle, req: CrawlerStartRequest) -> Result<CrawlerStatus, String> {
    let cfg = load_config(app);
    let url = format!("{}/api/crawler/start", normalize_base(&cfg.base_url));
    let resp = client()
        .post(&url)
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("启动失败: {e}"))?;
    if !resp.status().is_success() {
        return Err(map_err(resp).await);
    }
    status(app).await
}

pub async fn stop(app: &AppHandle) -> Result<CrawlerStatus, String> {
    let cfg = load_config(app);
    let url = format!("{}/api/crawler/stop", normalize_base(&cfg.base_url));
    let resp = client()
        .post(&url)
        .send()
        .await
        .map_err(|e| format!("停止失败: {e}"))?;
    if !resp.status().is_success() {
        return Err(map_err(resp).await);
    }
    status(app).await
}

pub async fn status(app: &AppHandle) -> Result<CrawlerStatus, String> {
    let cfg = load_config(app);
    let base = normalize_base(&cfg.base_url);
    let url = format!("{base}/api/crawler/status");
    let resp = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("获取状态失败: {e}"))?;
    if !resp.status().is_success() {
        return Err(map_err(resp).await);
    }
    let mut st: CrawlerStatus = resp
        .json()
        .await
        .map_err(|e| format!("解析状态失败: {e}"))?;
    st.base_url = base;
    Ok(st)
}

pub async fn logs(app: &AppHandle, limit: usize) -> Result<Vec<LogEntry>, String> {
    let cfg = load_config(app);
    let url = format!(
        "{}/api/crawler/logs?limit={}",
        normalize_base(&cfg.base_url),
        limit
    );
    let resp = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("获取日志失败: {e}"))?;
    if !resp.status().is_success() {
        return Err(map_err(resp).await);
    }
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("解析日志失败: {e}"))?;
    let logs = body
        .get("logs")
        .cloned()
        .unwrap_or(Value::Array(vec![]));
    serde_json::from_value(logs).map_err(|e| format!("解析日志失败: {e}"))
}

pub async fn list_data_files(
    app: &AppHandle,
    platform: Option<String>,
) -> Result<Vec<DataFileInfo>, String> {
    let cfg = load_config(app);
    let url = format!("{}/api/data/files", normalize_base(&cfg.base_url));
    let mut req = client().get(&url);
    if let Some(p) = platform {
        if !p.trim().is_empty() {
            req = req.query(&[("platform", p.trim())]);
        }
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("获取数据文件失败: {e}"))?;
    if !resp.status().is_success() {
        return Err(map_err(resp).await);
    }
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("解析数据文件失败: {e}"))?;
    let files = body
        .get("files")
        .cloned()
        .unwrap_or(Value::Array(vec![]));
    // modified_at 可能是 number；容错解析
    let mut out = Vec::new();
    if let Some(arr) = files.as_array() {
        for item in arr {
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let path = item
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let size = item.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
            let modified_at = item
                .get("modified_at")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let record_count = item.get("record_count").and_then(|v| v.as_u64());
            let ty = item
                .get("type")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            out.push(DataFileInfo {
                name,
                path,
                size,
                modified_at,
                record_count,
                r#type: ty,
            });
        }
    }
    Ok(out)
}
