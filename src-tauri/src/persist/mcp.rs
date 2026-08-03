use std::collections::HashMap;

use tauri::AppHandle;

use crate::mcp::McpServerConfig;

pub fn save_mcp_configs(app: &AppHandle, configs: &HashMap<String, McpServerConfig>) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(configs).unwrap_or_default();
    store.set("mcp_servers", val);
    let _ = store.save();
}

pub fn load_mcp_configs(app: &AppHandle) -> HashMap<String, McpServerConfig> {
    let Some(store) = super::open(app) else {
        return HashMap::new();
    };
    store
        .get("mcp_servers")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
