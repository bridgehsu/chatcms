use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use super::ScheduleProject;

fn open_store(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, "chatcms.json").build().ok()
}

pub fn save_all(app: &AppHandle, projects: &[ScheduleProject]) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(projects).unwrap_or_default();
    store.set("schedule_projects", val);
    let _ = store.save();
}

pub fn load_all(app: &AppHandle) -> Vec<ScheduleProject> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("schedule_projects")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
