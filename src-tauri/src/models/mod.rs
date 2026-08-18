pub mod commands;
pub mod repository;
pub mod router;
pub mod service;

use serde::{Deserialize, Serialize};

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
    /// 路由权重 1~4，越大越优先
    pub weight: i64,
    /// 最大 context token 数
    pub context_window: i64,
    pub enabled: bool,
    pub created: i64,
    pub updated: i64,
}

impl ProviderProfile {
    pub fn is_cloud(&self) -> bool {
        self.tier == "cloud"
    }

    pub fn is_local(&self) -> bool {
        self.tier == "local"
    }
}
