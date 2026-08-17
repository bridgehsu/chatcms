pub mod commands;
pub mod vault;
pub mod repository;

mod service;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use vault::{VaultState, is_configured, is_encrypted};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformAccount {
    pub id: String,
    pub name: String,
    pub platform: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub account_id: String,
    #[serde(default)]
    pub access_key: String,
    #[serde(default)]
    pub secret_key: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub notes: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlatformAccountInfo {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub phone: String,
    pub email: String,
    pub account_id: String,
    pub access_key: String,
    pub secret_key: String,
    pub has_access_key: bool,
    pub has_secret_key: bool,
    pub secrets_encrypted: bool,
    pub enabled: bool,
    pub notes: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultStatus {
    pub configured: bool,
    pub unlocked: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct RevealedSecrets {
    pub id: String,
    pub access_key: String,
    pub secret_key: String,
}

fn default_true() -> bool {
    true
}

pub(crate) fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn to_info(a: &PlatformAccount) -> PlatformAccountInfo {
    let enc = is_encrypted(&a.access_key) || is_encrypted(&a.secret_key);
    PlatformAccountInfo {
        id: a.id.clone(),
        name: a.name.clone(),
        platform: a.platform.clone(),
        phone: a.phone.clone(),
        email: a.email.clone(),
        account_id: a.account_id.clone(),
        access_key: String::new(),
        secret_key: String::new(),
        has_access_key: !a.access_key.is_empty(),
        has_secret_key: !a.secret_key.is_empty(),
        secrets_encrypted: enc,
        enabled: a.enabled,
        notes: a.notes.clone(),
        updated_at: a.updated_at,
    }
}

pub(crate) fn encrypt_fields(
    vault: &VaultState,
    app: &AppHandle,
    access_key: String,
    secret_key: String,
) -> Result<(String, String), String> {
    if !is_configured(app) {
        return Ok((access_key, secret_key));
    }
    if !vault.is_unlocked() {
        return Err("保险柜已锁定，请先解锁后再保存敏感信息".into());
    }
    Ok((
        vault.encrypt_secret(&access_key)?,
        vault.encrypt_secret(&secret_key)?,
    ))
}

pub use service::{vault_status, vault_setup, vault_unlock, vault_lock, list, reveal, add, update, remove};

pub type Vault<'a> = tauri::State<'a, VaultState>;
