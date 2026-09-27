use super::GeneratedImage;
use crate::agents::AgentState;
use crate::models;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn image_generate(
    app: AppHandle,
    state: State<'_, AgentState>,
    prompt: String,
    size: String,
    // 模型配置档案 id；优先于游离的 model + 全局激活 provider
    profile_id: Option<String>,
    // 未传 profile_id 时的兼容参数（旧前端）
    model: Option<String>,
) -> Result<GeneratedImage, String> {
    if let Some(id) = profile_id.filter(|s| !s.trim().is_empty()) {
        let profile = models::service::get(&app, &id)
            .await
            .ok_or_else(|| "模型配置不存在或已删除".to_string())?;
        if !profile.enabled {
            return Err("该模型配置已停用".into());
        }
        if !profile.is_image() {
            return Err("请选择用途为「图片」的模型配置".into());
        }
        return super::generate_with_profile(&app, &profile, prompt, size)
            .await
            .map_err(|e| e.to_string());
    }

    let config = state.config.lock().unwrap().clone();
    let model = model.unwrap_or_default();
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

#[allow(dead_code)]
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
