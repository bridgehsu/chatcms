use tauri::AppHandle;

use crate::accounts::PlatformAccount;

pub fn save_accounts(app: &AppHandle, accounts: &[PlatformAccount]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(accounts).unwrap_or_default();
    store.set("platform_accounts", val);
    let _ = store.save();
}

pub fn load_accounts(app: &AppHandle) -> Vec<PlatformAccount> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("platform_accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
