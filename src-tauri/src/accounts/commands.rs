use super::PlatformAccount;
use tauri::AppHandle;

#[tauri::command]
pub fn account_list(app: AppHandle) -> Vec<PlatformAccount> {
    super::list(&app)
}

#[tauri::command]
pub fn account_add(
    app: AppHandle,
    name: String,
    platform: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
) -> Result<PlatformAccount, String> {
    super::add(&app, name, platform, account_id, access_key, secret_key, enabled, notes)
}

#[tauri::command]
pub fn account_update(
    app: AppHandle,
    id: String,
    name: String,
    platform: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
) -> Result<PlatformAccount, String> {
    super::update(&app, id, name, platform, account_id, access_key, secret_key, enabled, notes)
}

#[tauri::command]
pub fn account_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::remove(&app, id)
}
