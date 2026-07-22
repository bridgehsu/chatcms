use std::collections::HashMap;
use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use crate::channels::ChannelConfig;
use crate::config::AppConfig;
use crate::knowledge::KnowledgeEntry;
use crate::mcp::McpServerConfig;
use crate::memory::Session;

const STORE_FILE: &str = "chatcms.json";

fn open(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, STORE_FILE).build().ok()
}

// ── Public API ────────────────────────────────────────────────────────────────

pub fn save_sessions(app: &AppHandle, sessions: &HashMap<String, Session>) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(sessions).unwrap_or_default();
    store.set("sessions", val);
    let _ = store.save();
}

pub fn save_config(app: &AppHandle, config: &AppConfig) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(config).unwrap_or_default();
    store.set("config", val);
    let _ = store.save();
}

pub fn load_sessions(app: &AppHandle) -> HashMap<String, Session> {
    let Some(store) = open(app) else {
        return HashMap::new();
    };
    store
        .get("sessions")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn load_config(app: &AppHandle) -> Option<AppConfig> {
    let store = open(app)?;
    store.get("config").and_then(|v| serde_json::from_value(v).ok())
}

pub fn save_mcp_configs(app: &AppHandle, configs: &HashMap<String, McpServerConfig>) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(configs).unwrap_or_default();
    store.set("mcp_servers", val);
    let _ = store.save();
}

pub fn load_mcp_configs(app: &AppHandle) -> HashMap<String, McpServerConfig> {
    let Some(store) = open(app) else {
        return HashMap::new();
    };
    store
        .get("mcp_servers")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_knowledge(app: &AppHandle, entries: &[KnowledgeEntry]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(entries).unwrap_or_default();
    store.set("knowledge", val);
    let _ = store.save();
}

pub fn load_knowledge(app: &AppHandle) -> Vec<KnowledgeEntry> {
    let Some(store) = open(app) else { return vec![] };
    store
        .get("knowledge")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_channel_config(app: &AppHandle, config: &ChannelConfig) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(config).unwrap_or_default();
    store.set("channel_config", val);
    let _ = store.save();
}

pub fn load_channel_config(app: &AppHandle) -> ChannelConfig {
    let Some(store) = open(app) else {
        return ChannelConfig::default();
    };
    store
        .get("channel_config")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
