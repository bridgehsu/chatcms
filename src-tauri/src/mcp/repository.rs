use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use super::McpServerConfig;

fn open_store(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, "chatcms.json").build().ok()
}

pub fn save_configs(app: &AppHandle, configs: &HashMap<String, McpServerConfig>) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(configs).unwrap_or_default();
    store.set("mcp_servers", val);
    let _ = store.save();
}

pub fn load_configs(app: &AppHandle) -> HashMap<String, McpServerConfig> {
    let Some(store) = open_store(app) else {
        return HashMap::new();
    };
    store
        .get("mcp_servers")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
