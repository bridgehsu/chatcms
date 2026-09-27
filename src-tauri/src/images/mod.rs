//! AI 生图：按模型配置 `kind` 分发协议。
//! - `openai` → `/v1/images/generations`
//! - `dashscope` → `/api/v1/services/aigc/multimodal-generation/generation`
//! 结果落盘并记入 SQLite。

pub mod commands;
pub mod repository;

mod service;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedImage {
    pub id: String,
    pub prompt: String,
    pub model: String,
    pub size: String,
    /// 绝对路径
    pub path: String,
    pub created: i64,
    /// 备注
    #[serde(default)]
    pub remark: String,
    /// 最近修改时间；旧数据缺省时为 0，前端回退 created
    #[serde(default)]
    pub updated: i64,
}

pub use service::{
    generate, generate_with_profile, import_from_url, import_bytes, upload_base64, update, list,
    delete, read_data_url,
};
