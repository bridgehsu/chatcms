use tauri::AppHandle;

use crate::nav_bookmarks::NavBookmark;

pub fn save_nav_bookmarks(app: &AppHandle, bookmarks: &[NavBookmark]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(bookmarks).unwrap_or_default();
    store.set("nav_bookmarks", val);
    let _ = store.save();
}

pub fn load_nav_bookmarks(app: &AppHandle) -> Vec<NavBookmark> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("nav_bookmarks")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
