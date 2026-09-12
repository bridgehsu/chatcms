use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use super::CrawlerTask;

fn open_store(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, "chatcms.json").build().ok()
}

pub fn save_all(app: &AppHandle, tasks: &[CrawlerTask]) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(tasks).unwrap_or_default();
    store.set("crawler_tasks", val);
    let _ = store.save();
}

pub fn load_all(app: &AppHandle) -> Vec<CrawlerTask> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("crawler_tasks")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
