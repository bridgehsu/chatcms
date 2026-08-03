use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// 工作目录（可选）
    #[serde(default)]
    pub cwd: Option<String>,
    /// 说明（UI）
    #[serde(default)]
    pub description: String,
    /// false 时保留配置但不自动连接
    #[serde(default = "default_true")]
    pub enabled: bool,
}

impl Default for McpServerConfig {
    fn default() -> Self {
        Self {
            command: String::new(),
            args: Vec::new(),
            env: HashMap::new(),
            cwd: None,
            description: String::new(),
            enabled: true,
        }
    }
}

pub(super) fn default_true() -> bool {
    true
}
