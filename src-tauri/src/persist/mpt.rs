use tauri::AppHandle;

/// MoneyPrinterTurbo 连接配置（JSON Value，避免 persist ↔ mpt 循环依赖）。
pub fn save_mpt_config(app: &AppHandle, config: &serde_json::Value) {
    let Some(store) = super::open(app) else { return };
    store.set("mpt_config", config.clone());
    let _ = store.save();
}

pub fn load_mpt_config(app: &AppHandle) -> Option<serde_json::Value> {
    let store = super::open(app)?;
    store.get("mpt_config")
}
