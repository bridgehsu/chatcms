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
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("nav_bookmarks")
        .invoke_handler(tauri::generate_handler![
            nav_bookmark_list,
            nav_bookmark_upsert,
            nav_bookmark_remove,
        ])
        .build()
}
