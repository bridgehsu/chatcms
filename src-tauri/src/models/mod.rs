pub mod commands;
pub mod repository;
pub mod router;
pub mod service;

use serde::{Deserialize, Serialize};
use serde_json::Value;

fn default_modality() -> String {
    "chat".into()
}

/// 模型 Provider 档案（持久化到 SQLite）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProfile {
    pub id: String,
    pub name: String,
    /// "anthropic" | "openai"
    pub kind: String,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
    /// "local" | "cloud"
    pub tier: String,
    /// 用途："chat"（会话）| "image"（生图）| "video"（生视频）
    #[serde(default = "default_modality")]
    pub modality: String,
    /// 路由权重 1~4，越大越优先
    pub weight: i64,
    /// 最大 context token 数
    pub context_window: i64,
    pub enabled: bool,
    pub created: i64,
    pub updated: i64,

    // ── 能力声明 ─────────────────────────────────────────────────────────────
    /// JSON 对象，描述该模型支持的能力，如 {"reasoning":true,"vision":false,"tools":true}
    pub capabilities: Value,

    // ── 思考模式 ─────────────────────────────────────────────────────────────
    /// 是否开启思考模式（Anthropic extended thinking / OpenAI <think> 标签解析）
    pub thinking: bool,
    /// 思考深度："low" | "medium" | "high"，影响 Anthropic 的 budget_tokens
    pub thinking_effort: String,

    // ── 生成参数默认值 ────────────────────────────────────────────────────────
    /// 采样温度，None = 使用 provider 默认值
    pub temperature: Option<f64>,
    /// 最大输出 token 数，None = 不限制（使用 provider 默认）
    pub max_output_tokens: Option<i64>,

    // ── Provider 私有参数透传 ─────────────────────────────────────────────────
    /// 额外 body 字段，直接合并进请求体（如 Ollama 的 {"think":true}）
    pub extra_body: Value,

    // ── 路由增强 ─────────────────────────────────────────────────────────────
    /// 标签列表，路由时用于能力匹配，如 ["reasoning","coding","vision"]
    pub tags: Vec<String>,
}

impl ProviderProfile {
    #[allow(dead_code)]
    pub fn is_cloud(&self) -> bool {
        self.tier == "cloud"
    }

    #[allow(dead_code)]
    pub fn is_local(&self) -> bool {
        self.tier == "local"
    }

    /// 归一化用途；旧数据缺省视为会话
    pub fn modality_key(&self) -> &str {
        match self.modality.as_str() {
            "image" | "video" => self.modality.as_str(),
            _ => "chat",
        }
    }

    pub fn is_chat(&self) -> bool {
        self.modality_key() == "chat"
    }

    pub fn is_image(&self) -> bool {
        self.modality_key() == "image"
    }

    #[allow(dead_code)]
    pub fn is_video(&self) -> bool {
        self.modality_key() == "video"
    }
}
