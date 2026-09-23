use tauri::AppHandle;

use crate::channels::ChannelConfig;

pub fn save_channel_config(app: &AppHandle, config: &ChannelConfig) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(config).unwrap_or_default();
    store.set("channel_config", val);
    let _ = store.save();
}

pub fn load_channel_config(app: &AppHandle) -> ChannelConfig {
    let Some(store) = super::open(app) else {
        return ChannelConfig::default();
    };
    let mut cfg: ChannelConfig = store
        .get("channel_config")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    cfg.migrate_legacy();
    cfg
}
