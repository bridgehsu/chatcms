use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::config::McpServerConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolDef {
    pub server: String,
    pub name: String,       // original name from the MCP server
    pub api_name: String,   // name sent to LLM: "{server}__{name}"
    pub description: String,
    pub input_schema: Value,
}

impl McpToolDef {
    /// Convert to the generic ToolDef used by the provider module.
    pub fn as_api_tool(&self) -> crate::agents::tools::ToolDef {
        crate::agents::tools::ToolDef {
            name: self.api_name.clone(),
            description: format!("[MCP:{}] {}", self.server, self.description),
            input_schema: self.input_schema.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum McpStatus {
    Disconnected,
    Connected { tools: usize },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub config: McpServerConfig,
    pub status: McpStatus,
}
