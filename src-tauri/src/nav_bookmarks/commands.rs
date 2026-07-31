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
    super::upsert(&app, id, title, url, note, sort_order, None)
}

#[tauri::command]
pub fn nav_bookmark_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::remove(&app, id)
}

#[tauri::command]
pub fn nav_custom_list(app: AppHandle) -> Vec<NavBookmark> {
    super::list_by_section(&app, Some("custom".into()))
}

#[tauri::command]
pub fn nav_custom_upsert(
    app: AppHandle,
    id: Option<String>,
    label: String,
    path: String,
    sort_order: Option<i32>,
) -> Result<NavBookmark, String> {
    super::upsert(&app, id, label, path, String::new(), sort_order, Some("custom".into()))
}

#[tauri::command]
pub fn nav_custom_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::remove(&app, id)
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("nav_bookmarks")
        .invoke_handler(tauri::generate_handler![
            nav_bookmark_list,
            nav_bookmark_upsert,
            nav_bookmark_remove,
            nav_custom_list,
            nav_custom_upsert,
            nav_custom_remove,
        ])
        .build()
}
