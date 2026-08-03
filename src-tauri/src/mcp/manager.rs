use std::collections::HashMap;

use anyhow::{anyhow, Result};
use serde_json::Value;

use super::client::McpClient;
use super::config::McpServerConfig;
use super::types::{McpServerInfo, McpStatus, McpToolDef};

// ── Manager (multiple servers) ────────────────────────────────────────────────

pub struct McpManager {
    pub configs: HashMap<String, McpServerConfig>,
    clients: HashMap<String, McpClient>,
    errors: HashMap<String, String>,
}

impl McpManager {
    pub fn new(configs: HashMap<String, McpServerConfig>) -> Self {
        Self {
            configs,
            clients: HashMap::new(),
            errors: HashMap::new(),
        }
    }

    /// Connect all configured servers; errors are stored per-server, not bubbled.
    pub async fn connect_all(&mut self) {
        let names: Vec<String> = self.configs.keys().cloned().collect();
        for name in names {
            self.connect_one(&name).await;
        }
    }

    async fn connect_one(&mut self, name: &str) {
        self.errors.remove(name);
        self.clients.remove(name);
        let Some(config) = self.configs.get(name).cloned() else {
            return;
        };
        if !config.enabled {
            return;
        }
        match McpClient::connect(name, &config).await {
            Ok(client) => {
                self.clients.insert(name.to_string(), client);
            }
            Err(e) => {
                self.errors.insert(name.to_string(), e.to_string());
            }
        }
    }

    pub async fn add_server(
        &mut self,
        name: String,
        config: McpServerConfig,
    ) -> Result<(), String> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err("名称不能为空".into());
        }
        if config.command.trim().is_empty() {
            return Err("命令不能为空".into());
        }
        if self.configs.contains_key(&name) {
            return Err(format!("已存在同名服务器「{name}」"));
        }
        self.configs.insert(name.clone(), config);
        self.connect_one(&name).await;
        Ok(())
    }

    pub async fn update_server(
        &mut self,
        name: &str,
        config: McpServerConfig,
    ) -> Result<(), String> {
        if !self.configs.contains_key(name) {
            return Err("服务器不存在".into());
        }
        if config.command.trim().is_empty() {
            return Err("命令不能为空".into());
        }
        self.clients.remove(name);
        self.errors.remove(name);
        self.configs.insert(name.to_string(), config);
        self.connect_one(name).await;
        Ok(())
    }

    pub fn remove_server(&mut self, name: &str) {
        self.configs.remove(name);
        self.clients.remove(name);
        self.errors.remove(name);
    }

    pub async fn reconnect(&mut self, name: &str) {
        self.clients.remove(name);
        self.connect_one(name).await;
    }

    pub fn disconnect(&mut self, name: &str) {
        self.clients.remove(name);
        self.errors.remove(name);
    }

    pub fn tools_for(&self, name: &str) -> Vec<McpToolDef> {
        self.clients
            .get(name)
            .map(|c| c.tools.clone())
            .unwrap_or_default()
    }

    /// All tools from connected servers, as API-ready ToolDefs.
    pub fn all_api_tools(&self) -> Vec<crate::tools::ToolDef> {
        self.clients
            .values()
            .flat_map(|c| c.tools.iter().map(|t| t.as_api_tool()))
            .collect()
    }

    /// Check if an api_name belongs to an MCP tool.
    pub fn is_mcp_tool(&self, api_name: &str) -> bool {
        self.clients
            .values()
            .flat_map(|c| c.tools.iter())
            .any(|t| t.api_name == api_name)
    }

    /// Call a tool by its api_name ("{server}__{tool}").
    pub async fn call_tool(&self, api_name: &str, arguments: Value) -> Result<String> {
        let tool = self
            .clients
            .values()
            .flat_map(|c| c.tools.iter())
            .find(|t| t.api_name == api_name)
            .ok_or_else(|| anyhow!("Unknown MCP tool: {api_name}"))?;

        let client = self
            .clients
            .get(&tool.server)
            .ok_or_else(|| anyhow!("MCP server not connected: {}", tool.server))?;

        client.call_tool(&tool.name, arguments).await
    }

    pub fn server_infos(&self) -> Vec<McpServerInfo> {
        let mut infos: Vec<McpServerInfo> = self
            .configs
            .iter()
            .map(|(name, config)| {
                let status = if !config.enabled {
                    McpStatus::Disconnected
                } else if let Some(client) = self.clients.get(name) {
                    McpStatus::Connected {
                        tools: client.tools.len(),
                    }
                } else if let Some(err) = self.errors.get(name) {
                    McpStatus::Error {
                        message: err.clone(),
                    }
                } else {
                    McpStatus::Disconnected
                };
                McpServerInfo {
                    name: name.clone(),
                    config: config.clone(),
                    status,
                }
            })
            .collect();
        infos.sort_by(|a, b| a.name.cmp(&b.name));
        infos
    }
}
