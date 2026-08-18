use super::BusinessMapState;
use tauri::AppHandle;

#[tauri::command]
pub fn map_state_get(app: AppHandle) -> BusinessMapState {
    super::get(&app)
}

#[tauri::command]
pub fn map_state_save(app: AppHandle, state: BusinessMapState) -> Result<(), String> {
    super::save(&app, state);
    Ok(())
}

#[allow(dead_code)]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("business_map")
        .invoke_handler(tauri::generate_handler![map_state_get, map_state_save])
        .build()
}
