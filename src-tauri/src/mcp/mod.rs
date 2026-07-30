pub mod commands;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot};

// ── Configuration ─────────────────────────────────────────────────────────────

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

fn default_true() -> bool {
    true
}

// ── Tool / server info (used for UI and provider) ─────────────────────────────

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
    pub fn as_api_tool(&self) -> crate::tools::ToolDef {
        crate::tools::ToolDef {
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

// ── Internal async state per subprocess ──────────────────────────────────────

struct ClientInner {
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>,
    writer_tx: mpsc::UnboundedSender<String>,
}

async fn writer_task(
    mut stdin: tokio::process::ChildStdin,
    mut rx: mpsc::UnboundedReceiver<String>,
) {
    while let Some(line) = rx.recv().await {
        let msg = format!("{}\n", line);
        if stdin.write_all(msg.as_bytes()).await.is_err() {
            break;
        }
    }
}

async fn reader_task(stdout: tokio::process::ChildStdout, inner: Arc<ClientInner>) {
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(val) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        // Ignore notifications (no id field)
        let Some(id) = val.get("id").and_then(|v| v.as_u64()) else {
            continue;
        };
        let result = if let Some(err) = val.get("error") {
            Err(anyhow!("MCP error: {}", err))
        } else {
            Ok(val.get("result").cloned().unwrap_or(Value::Null))
        };
        let mut pending = inner.pending.lock().unwrap();
        if let Some(tx) = pending.remove(&id) {
            let _ = tx.send(result);
        }
    }
}

// ── Single MCP client (one subprocess) ───────────────────────────────────────

pub struct McpClient {
    pub server_name: String,
    pub tools: Vec<McpToolDef>,
    inner: Arc<ClientInner>,
    _child: tokio::process::Child,
}

impl McpClient {
    pub async fn connect(name: &str, config: &McpServerConfig) -> Result<Self> {
        let mut cmd = tokio::process::Command::new(&config.command);
        cmd.args(&config.args)
            .envs(&config.env)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true);
        if let Some(cwd) = config.cwd.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
            cmd.current_dir(cwd);
        }

        let mut child = cmd.spawn()?;

        let stdin = child.stdin.take().ok_or_else(|| anyhow!("No stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("No stdout"))?;

        let (writer_tx, writer_rx) = mpsc::unbounded_channel();
        let inner = Arc::new(ClientInner {
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
            writer_tx,
        });

        tokio::spawn(writer_task(stdin, writer_rx));
        tokio::spawn(reader_task(stdout, inner.clone()));

        // Give the server a moment to start up
        tokio::time::sleep(Duration::from_millis(100)).await;

        let mut client = McpClient {
            server_name: name.to_string(),
            tools: vec![],
            inner,
            _child: child,
        };

        client.do_initialize().await?;
        client.tools = client.discover_tools().await?;

        Ok(client)
    }

    async fn request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.inner.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.inner.pending.lock().unwrap();
            pending.insert(id, tx);
        }

        let msg = serde_json::to_string(&json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        }))?;
        let _ = self.inner.writer_tx.send(msg);

        tokio::time::timeout(Duration::from_secs(30), rx)
            .await
            .map_err(|_| anyhow!("Timeout waiting for MCP '{}'", method))?
            .map_err(|_| anyhow!("Channel closed"))?
    }

    fn notify(&self, method: &str, params: Value) {
        if let Ok(msg) = serde_json::to_string(&json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        })) {
            let _ = self.inner.writer_tx.send(msg);
        }
    }

    async fn do_initialize(&self) -> Result<()> {
        self.request(
            "initialize",
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "chatcms", "version": "0.1.0" }
            }),
        )
        .await?;
        self.notify("notifications/initialized", json!({}));
        Ok(())
    }

    async fn discover_tools(&self) -> Result<Vec<McpToolDef>> {
        let result = self.request("tools/list", json!({})).await?;
        let items = result["tools"].as_array().cloned().unwrap_or_default();
        let server = self.server_name.clone();

        Ok(items
            .into_iter()
            .filter_map(|t| {
                let name = t["name"].as_str()?.to_string();
                let description = t["description"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let input_schema = t.get("inputSchema").cloned().unwrap_or(json!({"type":"object","properties":{}}));
                // Sanitize server name for use in identifiers
                let safe_server = server.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
                let api_name = format!("{}__{}", safe_server, name);
                Some(McpToolDef {
                    server: server.clone(),
                    name,
                    api_name,
                    description,
                    input_schema,
                })
            })
            .collect())
    }

    pub async fn call_tool(&self, tool_name: &str, arguments: Value) -> Result<String> {
        let result = self
            .request("tools/call", json!({ "name": tool_name, "arguments": arguments }))
            .await?;

        // Extract text content items
        let text = if let Some(items) = result["content"].as_array() {
            items
                .iter()
                .filter_map(|item| {
                    if item["type"] == "text" {
                        item["text"].as_str().map(String::from)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            serde_json::to_string_pretty(&result).unwrap_or_default()
        };

        Ok(text)
    }
}

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
