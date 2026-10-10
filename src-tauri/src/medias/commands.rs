use super::packages::{ScriptFile, ScriptPackage, ScriptPackageDetail, ScriptPackagePage};
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
    region: Option<String>,
) -> Result<MediaPlatform, String> {
    super::upsert_platform(
        &app, id, code, name, kind, inject_url, home_url, enabled, notes, region,
    )
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

// ── 脚本包（多文件 JS）──────────────────────────────────────

#[tauri::command]
pub fn script_pkg_list_page(
    app: AppHandle,
    query: Option<String>,
    page: u32,
    page_size: u32,
) -> ScriptPackagePage {
    super::packages::list_packages_page(&app, query, page, page_size)
}

#[tauri::command]
pub fn script_pkg_get(app: AppHandle, id: String) -> Result<ScriptPackageDetail, String> {
    super::packages::get_package_detail(&app, &id)
}

#[tauri::command]
pub fn script_pkg_create(
    app: AppHandle,
    code: String,
    name: String,
    notes: Option<String>,
) -> Result<ScriptPackageDetail, String> {
    super::packages::create_package(&app, code, name, notes.unwrap_or_default())
}

#[tauri::command]
pub fn script_pkg_update(
    app: AppHandle,
    id: String,
    name: String,
    code: String,
    enabled: bool,
    entry_path: String,
    notes: Option<String>,
) -> Result<ScriptPackageDetail, String> {
    super::packages::update_package_meta(
        &app,
        id,
        name,
        code,
        enabled,
        entry_path,
        notes.unwrap_or_default(),
    )
}

#[tauri::command]
pub fn script_pkg_set_enabled(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<ScriptPackage, String> {
    super::packages::set_enabled(&app, id, enabled)
}

#[tauri::command]
pub fn script_pkg_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::packages::remove_package(&app, id)
}

#[tauri::command]
pub fn script_file_upsert(
    app: AppHandle,
    package_id: String,
    path: String,
    draft_content: String,
) -> Result<ScriptFile, String> {
    super::packages::upsert_file(&app, package_id, path, draft_content)
}

#[tauri::command]
pub fn script_file_rename(
    app: AppHandle,
    package_id: String,
    from_path: String,
    to_path: String,
) -> Result<ScriptPackageDetail, String> {
    super::packages::rename_file(&app, package_id, from_path, to_path)
}

#[tauri::command]
pub fn script_file_delete(
    app: AppHandle,
    package_id: String,
    path: String,
) -> Result<ScriptPackageDetail, String> {
    super::packages::delete_file(&app, package_id, path)
}

#[tauri::command]
pub fn script_pkg_open_editor(app: AppHandle, id: String) -> Result<String, String> {
    super::packages::open_in_editor(&app, id)
}
