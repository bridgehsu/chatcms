use tauri::AppHandle;

use crate::permission::AuditEvent;

pub fn save_permission_audit(app: &AppHandle, events: &[AuditEvent]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(events).unwrap_or_default();
    store.set("permission_audit", val);
    let _ = store.save();
}

pub fn load_permission_audit(app: &AppHandle) -> Vec<AuditEvent> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("permission_audit")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
