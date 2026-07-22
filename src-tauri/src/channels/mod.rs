use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// ── Config ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TelegramConfig {
    pub token: String,
    /// Allowed chat IDs. Empty = deny all. ["*"] = allow all.
    #[serde(default)]
    pub allowed_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelConfig {
    #[serde(default)]
    pub telegram: Option<TelegramConfig>,
}

// ── Runtime state ─────────────────────────────────────────────────────────────

pub struct ChannelState {
    pub config: ChannelConfig,
    pub telegram_running: Arc<AtomicBool>,
    /// Maps Telegram chat_id → ChatCMS session_id for persistent conversations
    pub telegram_sessions: HashMap<String, String>,
}

impl Default for ChannelState {
    fn default() -> Self {
        Self {
            config: ChannelConfig::default(),
            telegram_running: Arc::new(AtomicBool::new(false)),
            telegram_sessions: HashMap::new(),
        }
    }
}

// ── Telegram API helpers ──────────────────────────────────────────────────────

fn allowed(id: &str, allowed_ids: &[String]) -> bool {
    if allowed_ids.is_empty() {
        return false;
    }
    allowed_ids.iter().any(|a| a == "*" || a == id)
}

async fn tg_get(client: &Client, token: &str, method: &str, params: Value) -> Result<Value> {
    let url = format!("https://api.telegram.org/bot{}/{}", token, method);
    let resp = client.post(&url).json(&params).send().await?.json::<Value>().await?;
    if resp["ok"].as_bool() != Some(true) {
        anyhow::bail!("Telegram API error: {}", resp["description"].as_str().unwrap_or("unknown"));
    }
    Ok(resp["result"].clone())
}

async fn send_message(client: &Client, token: &str, chat_id: &str, text: &str) -> Result<()> {
    // Telegram messages have a 4096 char limit
    let chunks: Vec<&str> = text
        .as_bytes()
        .chunks(4000)
        .map(|b| std::str::from_utf8(b).unwrap_or(""))
        .collect();

    for chunk in chunks {
        tg_get(
            client,
            token,
            "sendMessage",
            json!({ "chat_id": chat_id, "text": chunk }),
        )
        .await?;
    }
    Ok(())
}

// ── Polling loop ──────────────────────────────────────────────────────────────

/// Spawns a long-running Telegram polling task.
/// Returns an `Arc<AtomicBool>` that can be set to `false` to stop the loop.
pub fn start_telegram_poller(
    app: tauri::AppHandle,
    config: TelegramConfig,
    mut sessions: HashMap<String, String>,
    running: Arc<AtomicBool>,
) {
    tauri::async_runtime::spawn(async move {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(35))
            .build()
            .unwrap_or_default();

        let mut offset: i64 = 0;
        let token = config.token.clone();

        while running.load(Ordering::SeqCst) {
            let result = tg_get(
                &client,
                &token,
                "getUpdates",
                json!({
                    "offset": offset,
                    "timeout": 30,
                    "allowed_updates": ["message"],
                }),
            )
            .await;

            let updates = match result {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("[telegram] getUpdates error: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
            };

            let Some(arr) = updates.as_array() else {
                continue;
            };

            for update in arr {
                let update_id = update["update_id"].as_i64().unwrap_or(0);
                if update_id >= offset {
                    offset = update_id + 1;
                }

                let msg = &update["message"];
                let text = msg["text"].as_str().unwrap_or("").to_string();
                if text.is_empty() {
                    continue;
                }

                let chat_id = msg["chat"]["id"].to_string();
                let sender_id = msg["from"]["id"].to_string();

                if !allowed(&sender_id, &config.allowed_ids) && !allowed(&chat_id, &config.allowed_ids) {
                    eprintln!("[telegram] blocked sender={sender_id} chat={chat_id}");
                    continue;
                }

                // Route to agent
                let session_id = sessions.get(&chat_id).cloned();
                let new_sid =
                    route_to_agent(app.clone(), session_id, text, chat_id.clone()).await;

                if let Some(sid) = new_sid {
                    sessions.insert(chat_id.clone(), sid.clone());

                    // Get last assistant reply from session
                    let reply = get_last_reply(&app, &sid);
                    if let Some(text) = reply {
                        let _ = send_message(&client, &token, &chat_id, &text).await;
                    }
                }
            }
        }

        eprintln!("[telegram] poller stopped");
    });
}

async fn route_to_agent(
    app: tauri::AppHandle,
    session_id: Option<String>,
    content: String,
    _chat_id: String,
) -> Option<String> {
    use tauri::Manager;
    use crate::agent::{send_message, AgentState};

    let state = app.state::<AgentState>();
    match send_message(app.clone(), state, session_id, content).await {
        Ok(sid) => Some(sid),
        Err(e) => {
            eprintln!("[telegram] agent error: {e}");
            None
        }
    }
}

fn get_last_reply(app: &tauri::AppHandle, session_id: &str) -> Option<String> {
    use tauri::Manager;
    use crate::agent::AgentState;
    use crate::memory::Role;

    let state = app.state::<AgentState>();
    let sessions = state.sessions.lock().ok()?;
    let session = sessions.get(session_id)?;
    session
        .messages
        .iter()
        .rev()
        .find(|m| m.role == Role::Assistant)
        .map(|m| m.content.clone())
}
