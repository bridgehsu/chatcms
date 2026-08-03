use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot};

use super::config::McpServerConfig;
use super::types::McpToolDef;

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
