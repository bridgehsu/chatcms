use tauri::AppHandle;

use crate::config::AppConfig;

pub fn save_config(app: &AppHandle, config: &AppConfig) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(config).unwrap_or_default();
    store.set("config", val);
    let _ = store.save();
}

pub fn load_config(app: &AppHandle) -> Option<AppConfig> {
    let store = super::open(app)?;
    store.get("config").and_then(|v| serde_json::from_value(v).ok())
}
