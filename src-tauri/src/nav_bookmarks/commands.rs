use super::NavBookmark;
use tauri::AppHandle;

#[tauri::command]
pub fn nav_bookmark_list(app: AppHandle) -> Vec<NavBookmark> {
    super::list(&app)
}

#[tauri::command]
pub fn nav_bookmark_upsert(
    app: AppHandle,
    id: Option<String>,
    title: String,
    url: String,
    note: String,
    sort_order: Option<i32>,
) -> Result<NavBookmark, String> {
    super::upsert(&app, id, title, url, note, sort_order)
}

#[tauri::command]
pub fn nav_bookmark_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::remove(&app, id)
}
