use super::{MediaPlatform, MediaPlatformPage, PublishScriptView};
use tauri::AppHandle;

#[tauri::command]
pub fn media_platform_list(app: AppHandle) -> Vec<MediaPlatform> {
    super::list_platforms(&app)
}

#[tauri::command]
pub fn media_platform_list_page(
    app: AppHandle,
    query: Option<String>,
    kind: Option<String>,
    page: u32,
    page_size: u32,
) -> MediaPlatformPage {
    super::list_platforms_page(&app, query, kind, page, page_size)
}

#[tauri::command]
pub fn media_platform_get(app: AppHandle, id: String) -> Result<MediaPlatform, String> {
    super::get_platform(&app, &id).ok_or_else(|| "平台不存在".into())
}

#[tauri::command]
pub fn media_platform_upsert(
    app: AppHandle,
    id: Option<String>,
    code: String,
    name: String,
    kind: String,
    inject_url: String,
    home_url: String,
    enabled: bool,
    notes: String,
) -> Result<MediaPlatform, String> {
    super::upsert_platform(&app, id, code, name, kind, inject_url, home_url, enabled, notes)
}

#[tauri::command]
pub fn media_platform_set_enabled(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<MediaPlatform, String> {
    super::set_platform_enabled(&app, id, enabled)
}

#[tauri::command]
pub fn media_platform_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::remove_platform(&app, id)
}

#[tauri::command]
pub fn publish_script_get(app: AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    super::get_or_create_script(&app, platform_id)
}

#[tauri::command]
pub fn publish_script_list(
    app: AppHandle,
    platform_id: Option<String>,
) -> Vec<PublishScriptView> {
    super::list_scripts(&app, platform_id)
}

#[tauri::command]
pub fn publish_script_save_draft(
    app: AppHandle,
    platform_id: String,
    draft_script: String,
    match_url: String,
    changelog: String,
) -> Result<PublishScriptView, String> {
    super::save_script_draft(&app, platform_id, draft_script, match_url, changelog)
}

#[tauri::command]
pub fn publish_script_publish(app: AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    super::publish_script(&app, platform_id)
}

#[tauri::command]
pub fn publish_script_discard_draft(
    app: AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    super::discard_script_draft(&app, platform_id)
}

#[tauri::command]
pub fn collect_script_get(app: AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    super::get_or_create_collect_script(&app, platform_id)
}

#[tauri::command]
pub fn collect_script_list(
    app: AppHandle,
    platform_id: Option<String>,
) -> Vec<PublishScriptView> {
    super::list_collect_scripts(&app, platform_id)
}

#[tauri::command]
pub fn collect_script_save_draft(
    app: AppHandle,
    platform_id: String,
    draft_script: String,
    match_url: String,
    changelog: String,
) -> Result<PublishScriptView, String> {
    super::save_collect_script_draft(&app, platform_id, draft_script, match_url, changelog)
}

#[tauri::command]
pub fn collect_script_publish(
    app: AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    super::publish_collect_script(&app, platform_id)
}

#[tauri::command]
pub fn collect_script_discard_draft(
    app: AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    super::discard_collect_script_draft(&app, platform_id)
}
