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
pub async fn image_list(app: AppHandle) -> Vec<GeneratedImage> {
    super::list(&app).await
}

#[tauri::command]
pub async fn image_delete(app: AppHandle, id: String) -> Result<(), String> {
    super::delete(&app, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn image_upload(
    app: AppHandle,
    data_base64: String,
    filename: String,
    content_type: Option<String>,
) -> Result<GeneratedImage, String> {
    super::upload_base64(&app, &data_base64, &filename, content_type.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn image_update(
    app: AppHandle,
    id: String,
    title: String,
    remark: String,
) -> Result<GeneratedImage, String> {
    super::update(&app, id, title, remark).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn image_data_url(path: String) -> Result<String, String> {
    super::read_data_url(path).map_err(|e| e.to_string())
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("images")
        .invoke_handler(tauri::generate_handler![
            image_generate,
            image_list,
            image_delete,
            image_upload,
            image_update,
            image_data_url,
        ])
        .build()
}
