mod agent;
mod channels;
mod config;
mod knowledge;
mod mcp;
mod memory;
mod persist;
mod provider;
mod tools;

use agent::AgentState;
use channels::TelegramConfig;
use config::{AppConfig, ProviderConfig, ProviderKind};
use knowledge::KnowledgeEntry;
use mcp::{McpManager, McpServerConfig, McpServerInfo};
use memory::Session;
use serde_json::json;
use tauri::{Manager, State};

// ── Chat ──────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn chat_send(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
) -> Result<String, String> {
    agent::send_message(app, state, session_id, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn session_list(state: State<'_, AgentState>) -> Vec<serde_json::Value> {
    let sessions = state.sessions.lock().unwrap();
    let mut list: Vec<Session> = sessions.values().cloned().collect();
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list.iter()
        .map(|s| {
            json!({
                "id": s.id,
                "title": s.title,
                "updated_at": s.updated_at,
                "message_count": s.messages.len()
            })
        })
        .collect()
}

#[tauri::command]
fn session_get(state: State<'_, AgentState>, session_id: String) -> Option<Session> {
    state.sessions.lock().unwrap().get(&session_id).cloned()
}

// ── Config ────────────────────────────────────────────────────────────────────

#[tauri::command]
fn config_get(state: State<'_, AgentState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn config_set(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    api_key: String,
    model: String,
    provider: String,
    base_url: Option<String>,
) -> Result<(), String> {
    let kind = match provider.as_str() {
        "openai" => ProviderKind::OpenAI,
        _ => ProviderKind::Anthropic,
    };
    let new_config = AppConfig {
        provider: ProviderConfig { kind, api_key, model, base_url },
    };
    *state.config.lock().unwrap() = new_config.clone();
    persist::save_config(&app, &new_config);
    Ok(())
}

#[tauri::command]
fn permission_respond(state: State<'_, AgentState>, request_id: String, allowed: bool) {
    agent::resolve_permission(&state, &request_id, allowed);
}

// ── MCP ───────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn mcp_list(state: State<'_, AgentState>) -> Result<Vec<McpServerInfo>, String> {
    Ok(state.mcp.lock().await.server_infos())
}

#[tauri::command]
async fn mcp_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
    command: String,
    args: Vec<String>,
    env: std::collections::HashMap<String, String>,
) -> Result<McpServerInfo, String> {
    let config = McpServerConfig { command, args, env };
    let mut mcp = state.mcp.lock().await;
    mcp.add_server(name.clone(), config).await;
    persist::save_mcp_configs(&app, &mcp.configs);
    Ok(mcp.server_infos().into_iter().find(|s| s.name == name).unwrap())
}

#[tauri::command]
async fn mcp_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
) -> Result<(), String> {
    let mut mcp = state.mcp.lock().await;
    mcp.remove_server(&name);
    persist::save_mcp_configs(&app, &mcp.configs);
    Ok(())
}

#[tauri::command]
async fn mcp_reconnect(
    state: State<'_, AgentState>,
    name: String,
) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.reconnect(&name).await;
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Server {name} not found"))
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn knowledge_list(state: State<'_, AgentState>) -> Vec<KnowledgeEntry> {
    state.knowledge.lock().unwrap().clone()
}

#[tauri::command]
fn knowledge_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    title: String,
    description: String,
    content: String,
    tags: Vec<String>,
) -> Result<KnowledgeEntry, String> {
    let entry = KnowledgeEntry::new(title, description, content, tags);
    let mut entries = state.knowledge.lock().unwrap();
    entries.push(entry.clone());
    persist::save_knowledge(&app, &entries);
    Ok(entry)
}

#[tauri::command]
fn knowledge_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    let mut entries = state.knowledge.lock().unwrap();
    entries.retain(|e| e.id != id);
    persist::save_knowledge(&app, &entries);
    Ok(())
}

// ── Channels ──────────────────────────────────────────────────────────────────

#[tauri::command]
async fn channel_telegram_get(state: State<'_, AgentState>) -> Result<serde_json::Value, String> {
    let ch = state.channel.lock().await;
    let running = ch.telegram_running.load(std::sync::atomic::Ordering::SeqCst);
    let token = ch.config.telegram.as_ref().map(|t| t.token.clone()).unwrap_or_default();
    let allowed_ids = ch.config.telegram.as_ref().map(|t| t.allowed_ids.clone()).unwrap_or_default();
    Ok(json!({ "token": token, "allowed_ids": allowed_ids, "running": running }))
}

#[tauri::command]
async fn channel_telegram_set(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    token: String,
    allowed_ids: Vec<String>,
) -> Result<(), String> {
    let cfg = TelegramConfig { token, allowed_ids };
    let mut ch = state.channel.lock().await;
    ch.config.telegram = Some(cfg);
    persist::save_channel_config(&app, &ch.config);
    Ok(())
}

#[tauri::command]
async fn channel_telegram_start(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    if ch.telegram_running.load(std::sync::atomic::Ordering::SeqCst) {
        return Ok(()); // already running
    }
    let Some(tg_config) = ch.config.telegram.clone() else {
        return Err("Telegram not configured".to_string());
    };
    if tg_config.token.is_empty() {
        return Err("Telegram token is empty".to_string());
    }

    ch.telegram_running.store(true, std::sync::atomic::Ordering::SeqCst);
    let running = ch.telegram_running.clone();
    let sessions = ch.telegram_sessions.clone();

    channels::start_telegram_poller(app, tg_config, sessions, running);
    Ok(())
}

#[tauri::command]
async fn channel_telegram_stop(state: State<'_, AgentState>) -> Result<(), String> {
    let ch = state.channel.lock().await;
    ch.telegram_running.store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AgentState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<AgentState>();

            if let Some(config) = persist::load_config(&handle) {
                *state.config.lock().unwrap() = config;
            }
            *state.sessions.lock().unwrap() = persist::load_sessions(&handle);
            *state.knowledge.lock().unwrap() = persist::load_knowledge(&handle);

            // MCP
            let mcp_configs = persist::load_mcp_configs(&handle);
            if !mcp_configs.is_empty() {
                let h2 = handle.clone();
                tauri::async_runtime::spawn(async move {
                    let s = h2.state::<AgentState>();
                    let mut mcp = s.mcp.lock().await;
                    mcp.configs = mcp_configs;
                    mcp.connect_all().await;
                });
            }

            // Channels
            let channel_cfg = persist::load_channel_config(&handle);
            let h3 = handle.clone();
            tauri::async_runtime::spawn(async move {
                let s = h3.state::<AgentState>();
                let mut ch = s.channel.lock().await;
                ch.config = channel_cfg;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat_send,
            session_list,
            session_get,
            config_get,
            config_set,
            permission_respond,
            mcp_list,
            mcp_add,
            mcp_remove,
            mcp_reconnect,
            knowledge_list,
            knowledge_add,
            knowledge_remove,
            channel_telegram_get,
            channel_telegram_set,
            channel_telegram_start,
            channel_telegram_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
