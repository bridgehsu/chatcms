//! 外部频道：多 IM 渠道注册表；运行时目前仅 Telegram。
//! 不同平台可同时启用；同一 kind（如 Telegram）仅一份配置 / 一个运行时。

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

/// 预留渠道的通用草稿配置（Discord / 飞书等）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelDraft {
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub webhook: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub extra: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelConfig {
    #[serde(default)]
    pub telegram: Option<TelegramConfig>,
    /// 当前已启用的平台列表（可多项；每项 kind 至多出现一次）
    #[serde(default)]
    pub enabled_kinds: Vec<String>,
    /// 旧版全局互斥字段，读入后迁移到 enabled_kinds
    #[serde(default, skip_serializing)]
    pub active_kind: Option<String>,
    #[serde(default)]
    pub drafts: HashMap<String, ChannelDraft>,
}

impl ChannelConfig {
    pub fn migrate_legacy(&mut self) {
        if let Some(kind) = self.active_kind.take() {
            self.set_kind_enabled(&kind, true);
        }
    }

    pub fn is_kind_enabled(&self, kind: &str) -> bool {
        self.enabled_kinds.iter().any(|k| k == kind)
    }

    pub fn set_kind_enabled(&mut self, kind: &str, enabled: bool) {
        if enabled {
            if !self.is_kind_enabled(kind) {
                self.enabled_kinds.push(kind.to_string());
            }
        } else {
            self.enabled_kinds.retain(|k| k != kind);
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ChannelInfo {
    pub kind: String,
    pub label: String,
    pub description: String,
    /// 后端是否已实现运行时
    pub supported: bool,
    pub configured: bool,
    pub enabled: bool,
    pub status: String,
}

const KIND_META: &[(&str, &str, &str, bool)] = &[
    (
        "telegram",
        "Telegram",
        "通过 Bot Token 长轮询与 Agent 对话",
        true,
    ),
    (
        "discord",
        "Discord",
        "Discord Bot（即将支持）",
        false,
    ),
    (
        "whatsapp",
        "WhatsApp",
        "WhatsApp Business API（即将支持）",
        false,
    ),
    ("feishu", "飞书", "飞书机器人（即将支持）", false),
    ("wechat", "微信", "企业微信 / 公众号（即将支持）", false),
    ("dingtalk", "钉钉", "钉钉机器人（即将支持）", false),
];

pub fn known_kinds() -> &'static [(&'static str, &'static str, &'static str, bool)] {
    KIND_META
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

    pub fn list_infos(&self) -> Vec<ChannelInfo> {
        KIND_META
            .iter()
            .map(|(kind, label, desc, supported)| {
                let configured = match *kind {
                    "telegram" => self
                        .config
                        .telegram
                        .as_ref()
                        .map(|t| !t.token.trim().is_empty())
                        .unwrap_or(false),
                    other => self
                        .config
                        .drafts
                        .get(other)
                        .map(|d| !d.token.trim().is_empty() || !d.webhook.trim().is_empty())
                        .unwrap_or(false),
                };
                let marked = self.config.is_kind_enabled(kind);
                let enabled = marked
                    && if *kind == "telegram" {
                        self.is_telegram_running()
                    } else {
                        // 未实现运行时时不展示为「运行中」
                        false
                    };
                let status = if !*supported {
                    "coming_soon".into()
                } else if enabled {
                    "running".into()
                } else if configured {
                    "ready".into()
                } else {
                    "idle".into()
                };
                ChannelInfo {
                    kind: (*kind).into(),
                    label: (*label).into(),
                    description: (*desc).into(),
                    supported: *supported,
                    configured,
                    enabled,
                    status,
                }
            })
            .collect()
    }
}

/// 停掉所有已实现渠道的运行时，并清空启用列表。
pub async fn disable_all(state: &mut ChannelState) {
    stop_telegram_poller(state).await;
    state.config.enabled_kinds.clear();
}

/// 启用指定平台（不影响其它已启用平台；同 kind 仅重启自身）。
pub async fn enable_kind(
    state: &mut ChannelState,
    app: AppHandle,
    kind: &str,
) -> Result<(), String> {
    let meta = KIND_META
        .iter()
        .find(|(k, _, _, _)| *k == kind)
        .ok_or_else(|| format!("未知渠道: {kind}"))?;
    if !meta.3 {
        return Err(format!("{} 即将接入，暂不可启用", meta.1));
    }

    match kind {
        "telegram" => {
            restart_telegram_poller(state, app).await?;
            state.config.set_kind_enabled("telegram", true);
            Ok(())
        }
        _ => Err(format!("{kind} 运行时尚未实现")),
    }
}

pub async fn disable_kind(state: &mut ChannelState, kind: &str) -> Result<(), String> {
    if !state.config.is_kind_enabled(kind) {
        // 兼容：运行中但标记丢失时仍可停
        if kind == "telegram" && state.is_telegram_running() {
            stop_telegram_poller(state).await;
        }
        return Ok(());
    }
    match kind {
        "telegram" => stop_telegram_poller(state).await,
        _ => {}
    }
    state.config.set_kind_enabled(kind, false);
    Ok(())
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
    state.config.set_kind_enabled("telegram", true);
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
