use std::collections::HashMap;

use tauri::AppHandle;

/// 浏览器扩展 page_key → session_id 绑定。
pub fn save_page_bindings(app: &AppHandle, bindings: &HashMap<String, String>) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(bindings).unwrap_or_default();
    store.set("page_bindings", val);
    let _ = store.save();
}

pub fn load_page_bindings(app: &AppHandle) -> HashMap<String, String> {
    let Some(store) = super::open(app) else {
        return HashMap::new();
    };
    store
        .get("page_bindings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
