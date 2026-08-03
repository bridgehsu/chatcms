use tauri::AppHandle;

use crate::images::GeneratedImage;

pub fn save_images(app: &AppHandle, images: &[GeneratedImage]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(images).unwrap_or_default();
    store.set("generated_images", val);
    let _ = store.save();
}

pub fn load_images(app: &AppHandle) -> Vec<GeneratedImage> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("generated_images")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
