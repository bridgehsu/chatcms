use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use super::{MediaPlatform, PublishScript};

fn open_store(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, "chatcms.json").build().ok()
}

pub fn save_platforms(app: &AppHandle, platforms: &[MediaPlatform]) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(platforms).unwrap_or_default();
    store.set("media_platforms", val);
    let _ = store.save();
}

pub fn load_platforms(app: &AppHandle) -> Vec<MediaPlatform> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("media_platforms")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_publish_scripts(app: &AppHandle, scripts: &[PublishScript]) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(scripts).unwrap_or_default();
    store.set("publish_scripts", val);
    let _ = store.save();
}

pub fn load_publish_scripts(app: &AppHandle) -> Vec<PublishScript> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("publish_scripts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_collect_scripts(app: &AppHandle, scripts: &[PublishScript]) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(scripts).unwrap_or_default();
    store.set("collect_scripts", val);
    let _ = store.save();
}

pub fn load_collect_scripts(app: &AppHandle) -> Vec<PublishScript> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("collect_scripts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
