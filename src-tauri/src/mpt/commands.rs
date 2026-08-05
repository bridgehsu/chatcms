use super::{MptConfig, MptFileItem, MptTaskStatus, MptVideoParams};
use crate::videos::GeneratedVideo;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub fn mpt_config_get(app: AppHandle) -> MptConfig {
    super::load_config(&app)
}

#[tauri::command]
pub fn mpt_config_set(app: AppHandle, base_url: String) -> Result<MptConfig, String> {
    let cfg = MptConfig {
        base_url: base_url.trim().to_string(),
    };
    super::save_config(&app, &cfg);
    Ok(super::load_config(&app))
}

#[tauri::command]
pub async fn mpt_health(app: AppHandle) -> Result<String, String> {
    super::health_check(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_meta_options(app: AppHandle) -> Result<Value, String> {
    super::meta_options(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_meta_voices(app: AppHandle, tts_server: String) -> Result<Value, String> {
    super::meta_voices(&app, tts_server)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_voice_preview(
    app: AppHandle,
    text: String,
    voice_name: String,
    voice_rate: f64,
    voice_volume: f64,
) -> Result<String, String> {
    super::voice_preview(&app, text, voice_name, voice_rate, voice_volume)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_studio_config_get(app: AppHandle) -> Result<Value, String> {
    super::studio_config_get(&app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_studio_config_set(app: AppHandle, config: Value) -> Result<Value, String> {
    super::studio_config_set(&app, config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_generate_script(
    app: AppHandle,
    video_subject: String,
    video_language: String,
    paragraph_number: i32,
    video_script_prompt: Option<String>,
    custom_system_prompt: Option<String>,
) -> Result<String, String> {
    super::generate_script(
        &app,
        video_subject,
        video_language,
        paragraph_number,
        video_script_prompt.unwrap_or_default(),
        custom_system_prompt.unwrap_or_default(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_generate_terms(
    app: AppHandle,
    video_subject: String,
    video_script: String,
    amount: i32,
) -> Result<Vec<String>, String> {
    super::generate_terms(&app, video_subject, video_script, amount)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_create_video(
    app: AppHandle,
    params: MptVideoParams,
) -> Result<String, String> {
    super::create_video(&app, params)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_get_task(app: AppHandle, task_id: String) -> Result<MptTaskStatus, String> {
    super::get_task(&app, &task_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_import_video(
    app: AppHandle,
    video_url: String,
    title: String,
    task_id: Option<String>,
) -> Result<GeneratedVideo, String> {
    super::import_video_url(&app, &video_url, &title, task_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_list_bgm(app: AppHandle) -> Result<Vec<MptFileItem>, String> {
    super::list_bgm(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_upload_bgm(
    app: AppHandle,
    data_base64: String,
    filename: String,
) -> Result<String, String> {
    super::upload_bgm(&app, data_base64, filename)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_list_materials(app: AppHandle) -> Result<Vec<MptFileItem>, String> {
    super::list_materials(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_upload_material(
    app: AppHandle,
    data_base64: String,
    filename: String,
) -> Result<String, String> {
    super::upload_material(&app, data_base64, filename)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mpt_upload_custom_audio(
    app: AppHandle,
    data_base64: String,
    filename: String,
) -> Result<String, String> {
    super::upload_custom_audio(&app, data_base64, filename)
        .await
        .map_err(|e| e.to_string())
}
