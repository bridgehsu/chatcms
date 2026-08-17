use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use super::NavBookmark;

fn open_store(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, "chatcms.json").build().ok()
}

pub fn save(app: &AppHandle, bookmarks: &[NavBookmark]) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(bookmarks).unwrap_or_default();
    store.set("nav_bookmarks", val);
    let _ = store.save();
}

pub fn load_all(app: &AppHandle) -> Vec<NavBookmark> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("nav_bookmarks")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
