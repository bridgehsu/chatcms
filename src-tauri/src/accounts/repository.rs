use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use super::PlatformAccount;
use super::vault::VaultMeta;

fn open_store(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, "chatcms.json").build().ok()
}

pub fn save_accounts(app: &AppHandle, accounts: &[PlatformAccount]) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(accounts).unwrap_or_default();
    store.set("platform_accounts", val);
    let _ = store.save();
}

pub fn load_accounts(app: &AppHandle) -> Vec<PlatformAccount> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("platform_accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_vault_meta(app: &AppHandle, meta: &VaultMeta) {
    let Some(store) = open_store(app) else { return };
    let val = serde_json::to_value(meta).unwrap_or_default();
    store.set("account_vault", val);
    let _ = store.save();
}

pub fn load_vault_meta(app: &AppHandle) -> VaultMeta {
    let Some(store) = open_store(app) else {
        return VaultMeta::default();
    };
    store
        .get("account_vault")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
