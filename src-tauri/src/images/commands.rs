use super::GeneratedImage;
use crate::agent::AgentState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn image_generate(
    app: AppHandle,
    state: State<'_, AgentState>,
    prompt: String,
    model: String,
    size: String,
) -> Result<GeneratedImage, String> {
    let config = state.config.lock().unwrap().clone();
    super::generate(&app, config, prompt, model, size)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn image_list(app: AppHandle) -> Vec<GeneratedImage> {
    super::list(&app)
}

#[tauri::command]
pub fn image_delete(app: AppHandle, id: String) -> Result<(), String> {
    super::delete(&app, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn image_upload(
    app: AppHandle,
    data_base64: String,
    filename: String,
    content_type: Option<String>,
) -> Result<GeneratedImage, String> {
    super::upload_base64(&app, &data_base64, &filename, content_type.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn image_update(
    app: AppHandle,
    id: String,
    title: String,
    note: String,
) -> Result<GeneratedImage, String> {
    super::update(&app, id, title, note).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn image_data_url(path: String) -> Result<String, String> {
    super::read_data_url(path).map_err(|e| e.to_string())
}
