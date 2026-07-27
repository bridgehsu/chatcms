//! 外部频道：Telegram 长轮询。启动前会停掉旧 poller，避免 getUpdates Conflict。

use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

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
    /// 当前 poller 的运行标志（每次 start 换新 Arc，旧任务只看旧 Arc）
    pub telegram_running: Arc<AtomicBool>,
    /// Maps Telegram chat_id → ChatCMS session_id
    pub telegram_sessions: Arc<Mutex<HashMap<String, String>>>,
    telegram_task: Option<tauri::async_runtime::JoinHandle<()>>,
}

impl Default for ChannelState {
    fn default() -> Self {
        Self {
            config: ChannelConfig::default(),
            telegram_running: Arc::new(AtomicBool::new(false)),
            telegram_sessions: Arc::new(Mutex::new(HashMap::new())),
            telegram_task: None,
        }
    }
}

impl ChannelState {
    pub fn is_telegram_running(&self) -> bool {
        self.telegram_running.load(Ordering::SeqCst) && self.telegram_task.is_some()
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
    let resp = client
        .post(&url)
        .json(&params)
        .send()
        .await?
        .json::<Value>()
        .await?;
    if resp["ok"].as_bool() != Some(true) {
        anyhow::bail!(
            "Telegram API error: {}",
            resp["description"].as_str().unwrap_or("unknown")
        );
    }
    Ok(resp["result"].clone())
}

async fn delete_webhook(client: &Client, token: &str) -> Result<()> {
    tg_get(
        client,
        token,
        "deleteWebhook",
        json!({ "drop_pending_updates": false }),
    )
    .await?;
    Ok(())
}

async fn send_message(client: &Client, token: &str, chat_id: &str, text: &str) -> Result<()> {
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

fn is_conflict_error(err: &anyhow::Error) -> bool {
    let s = err.to_string();
    s.contains("Conflict") || s.contains("terminated by other getUpdates")
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/// 停止当前 poller：置位 + abort 任务，避免与下一次 getUpdates 冲突。
pub async fn stop_telegram_poller(state: &mut ChannelState) {
    state.telegram_running.store(false, Ordering::SeqCst);
    if let Some(handle) = state.telegram_task.take() {
        handle.abort();
        // 给 Telegram 侧释放上一次长轮询一点时间
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        eprintln!("[telegram] previous poller aborted");
    }
}

/// 先停旧任务再启动；并 deleteWebhook，减少 Conflict。
pub async fn restart_telegram_poller(
    state: &mut ChannelState,
    app: AppHandle,
) -> Result<(), String> {
    let Some(tg_config) = state.config.telegram.clone() else {
        return Err("Telegram not configured".into());
    };
    if tg_config.token.trim().is_empty() {
        return Err("Telegram token is empty".into());
    }

    stop_telegram_poller(state).await;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    if let Err(e) = delete_webhook(&client, &tg_config.token).await {
        eprintln!("[telegram] deleteWebhook warning: {e}");
    }

    let running = Arc::new(AtomicBool::new(true));
    state.telegram_running = running.clone();
    let sessions = state.telegram_sessions.clone();
    let token = tg_config.token.clone();
    let allowed_ids = tg_config.allowed_ids.clone();

    let handle = tauri::async_runtime::spawn(async move {
        run_poll_loop(app, token, allowed_ids, sessions, running).await;
    });
    state.telegram_task = Some(handle);
    eprintln!("[telegram] poller started");
    Ok(())
}

async fn run_poll_loop(
    app: AppHandle,
    token: String,
    allowed_ids: Vec<String>,
    sessions: Arc<Mutex<HashMap<String, String>>>,
    running: Arc<AtomicBool>,
) {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(35))
        .build()
        .unwrap_or_default();

    let mut offset: i64 = 0;
    let mut conflict_streak: u32 = 0;

    while running.load(Ordering::SeqCst) {
        let result = tg_get(
            &client,
            &token,
            "getUpdates",
            json!({
                "offset": offset,
                "timeout": 25,
                "allowed_updates": ["message"],
            }),
        )
        .await;

        if !running.load(Ordering::SeqCst) {
            break;
        }

        let updates = match result {
            Ok(v) => {
                conflict_streak = 0;
                v
            }
            Err(e) => {
                if is_conflict_error(&e) {
                    conflict_streak = conflict_streak.saturating_add(1);
                    eprintln!(
                        "[telegram] getUpdates conflict (#{conflict_streak}): {e} — clearing webhook & backing off"
                    );
                    let _ = delete_webhook(&client, &token).await;
                    let wait = std::cmp::min(5 + conflict_streak * 2, 20);
                    tokio::time::sleep(std::time::Duration::from_secs(u64::from(wait))).await;
                } else {
                    eprintln!("[telegram] getUpdates error: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
                continue;
            }
        };

        let Some(arr) = updates.as_array() else {
            continue;
        };

        for update in arr {
            if !running.load(Ordering::SeqCst) {
                break;
            }

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

            if !allowed(&sender_id, &allowed_ids) && !allowed(&chat_id, &allowed_ids) {
                eprintln!("[telegram] blocked sender={sender_id} chat={chat_id}");
                continue;
            }

            let session_id = sessions
                .lock()
                .ok()
                .and_then(|m| m.get(&chat_id).cloned());

            let new_sid = route_to_agent(app.clone(), session_id, text).await;

            if let Some(sid) = new_sid {
                if let Ok(mut map) = sessions.lock() {
                    map.insert(chat_id.clone(), sid.clone());
                }
                let _ = app.emit("sessions-changed", json!({ "source": "telegram", "session_id": sid }));

                if let Some(reply) = get_last_reply(&app, &sid) {
                    if let Err(e) = send_message(&client, &token, &chat_id, &reply).await {
                        eprintln!("[telegram] sendMessage error: {e}");
                    }
                }
            }
        }
    }

    eprintln!("[telegram] poller stopped");
}

async fn route_to_agent(
    app: AppHandle,
    session_id: Option<String>,
    content: String,
) -> Option<String> {
    use crate::agent::{send_message, AgentState};
    use tauri::Manager;

    let state = app.state::<AgentState>();
    match send_message(app.clone(), state, session_id, content).await {
        Ok(sid) => Some(sid),
        Err(e) => {
            eprintln!("[telegram] agent error: {e}");
            None
        }
    }
}

fn get_last_reply(app: &AppHandle, session_id: &str) -> Option<String> {
    use crate::agent::AgentState;
    use crate::memory::Role;
    use tauri::Manager;

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
