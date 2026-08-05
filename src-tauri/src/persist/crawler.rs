use tauri::AppHandle;

pub fn save_crawler_config(app: &AppHandle, config: &serde_json::Value) {
    let Some(store) = super::open(app) else { return };
    store.set("crawler_config", config.clone());
    let _ = store.save();
}

pub fn load_crawler_config(app: &AppHandle) -> Option<serde_json::Value> {
    let store = super::open(app)?;
    store.get("crawler_config")
}
