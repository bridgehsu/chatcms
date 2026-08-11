use super::{PlatformAccountInfo, RevealedSecrets, VaultStatus, VaultState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn account_list(app: AppHandle) -> Vec<PlatformAccountInfo> {
    super::list(&app)
}

#[tauri::command]
pub fn account_add(
    app: AppHandle,
    vault: State<'_, VaultState>,
    name: String,
    platform: String,
    phone: String,
    email: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
) -> Result<PlatformAccountInfo, String> {
    super::add(
        &app,
        &vault,
        name,
        platform,
        phone,
        email,
        account_id,
        access_key,
        secret_key,
        enabled,
        notes,
    )
}

#[tauri::command]
pub fn account_update(
    app: AppHandle,
    vault: State<'_, VaultState>,
    id: String,
    name: String,
    platform: String,
    phone: String,
    email: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
    update_secrets: Option<bool>,
) -> Result<PlatformAccountInfo, String> {
    super::update(
        &app,
        &vault,
        id,
        name,
        platform,
        phone,
        email,
        account_id,
        access_key,
        secret_key,
        enabled,
        notes,
        update_secrets.unwrap_or(true),
    )
}

#[tauri::command]
pub fn account_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::remove(&app, id)
}

#[tauri::command]
pub fn account_reveal(
    app: AppHandle,
    vault: State<'_, VaultState>,
    id: String,
) -> Result<RevealedSecrets, String> {
    super::reveal(&app, &vault, id)
}

#[tauri::command]
pub fn vault_status(app: AppHandle, vault: State<'_, VaultState>) -> VaultStatus {
    super::vault_status(&app, &vault)
}

#[tauri::command]
pub fn vault_setup(
    app: AppHandle,
    vault: State<'_, VaultState>,
    password: String,
) -> Result<VaultStatus, String> {
    super::vault_setup(&app, &vault, password)
}

#[tauri::command]
pub fn vault_unlock(
    app: AppHandle,
    vault: State<'_, VaultState>,
    password: String,
) -> Result<VaultStatus, String> {
    super::vault_unlock(&app, &vault, password)
}

#[tauri::command]
pub fn vault_lock(app: AppHandle, vault: State<'_, VaultState>) -> VaultStatus {
    vault.lock();
    super::vault_status(&app, &vault)
}
