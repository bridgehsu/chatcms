use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub provider: ProviderConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub kind: ProviderKind,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Anthropic,
    OpenAI,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            provider: ProviderConfig {
                kind: ProviderKind::Anthropic,
                api_key: String::new(),
                model: "claude-sonnet-4-6".to_string(),
                base_url: None,
            },
        }
    }
}
