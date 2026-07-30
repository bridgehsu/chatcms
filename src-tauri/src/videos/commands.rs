use super::GeneratedVideo;
use crate::agent::AgentState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn video_generate(
    app: AppHandle,
    state: State<'_, AgentState>,
    prompt: String,
    model: String,
    size: String,
    seconds: String,
) -> Result<GeneratedVideo, String> {
    let config = state.config.lock().unwrap().clone();
    super::generate(&app, config, prompt, model, size, seconds)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn video_list(app: AppHandle) -> Vec<GeneratedVideo> {
    super::list(&app)
}

#[tauri::command]
pub fn video_delete(app: AppHandle, id: String) -> Result<(), String> {
    super::delete(&app, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn video_upload(
    app: AppHandle,
    data_base64: String,
    filename: String,
    content_type: Option<String>,
) -> Result<GeneratedVideo, String> {
    super::upload_base64(&app, &data_base64, &filename, content_type.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn video_update(
    app: AppHandle,
    id: String,
    title: String,
    note: String,
) -> Result<GeneratedVideo, String> {
    super::update(&app, id, title, note).map_err(|e| e.to_string())
}
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("videos")
        .invoke_handler(tauri::generate_handler![
            video_generate,
            video_list,
            video_delete,
            video_upload,
            video_update,
        ])
        .build()
}
