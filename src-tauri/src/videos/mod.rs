//! AI 生视频：OpenAI Videos API（`/v1/videos`）异步任务 → 下载 MP4 落盘。

pub mod commands;
pub mod repository;

mod service;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedVideo {
    pub id: String,
    pub prompt: String,
    pub model: String,
    pub size: String,
    pub seconds: String,
    /// 绝对路径（mp4）
    pub path: String,
    pub created: i64,
    /// 远端 job id（若有）
    pub remote_id: Option<String>,
    /// 备注
    #[serde(default)]
    pub remark: String,
    /// 最近修改时间；旧数据缺省时为 0
    #[serde(default)]
    pub updated: i64,
}

pub use service::{generate, import_from_url, import_bytes, upload_base64, update, list, delete};
