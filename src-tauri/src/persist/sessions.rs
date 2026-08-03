use std::collections::HashMap;

use tauri::AppHandle;

use crate::memory::Session;

pub fn save_sessions(app: &AppHandle, sessions: &HashMap<String, Session>) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(sessions).unwrap_or_default();
    store.set("sessions", val);
    let _ = store.save();
}

pub fn load_sessions(app: &AppHandle) -> HashMap<String, Session> {
    let Some(store) = super::open(app) else {
        return HashMap::new();
    };
    store
        .get("sessions")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
