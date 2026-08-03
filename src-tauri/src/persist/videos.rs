use tauri::AppHandle;

use crate::videos::GeneratedVideo;

pub fn save_videos(app: &AppHandle, videos: &[GeneratedVideo]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(videos).unwrap_or_default();
    store.set("generated_videos", val);
    let _ = store.save();
}

pub fn load_videos(app: &AppHandle) -> Vec<GeneratedVideo> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("generated_videos")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
