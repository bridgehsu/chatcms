use tauri::AppHandle;

use crate::business_map::BusinessMapState;

pub fn save_business_map(app: &AppHandle, state: &BusinessMapState) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(state).unwrap_or_default();
    store.set("business_map", val);
    let _ = store.save();
}

pub fn load_business_map(app: &AppHandle) -> BusinessMapState {
    let Some(store) = super::open(app) else {
        return Default::default();
    };
    store
        .get("business_map")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
