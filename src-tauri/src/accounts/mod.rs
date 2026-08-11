pub mod commands;
pub mod vault;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

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
    /// 公钥 / 账号标识（明文）
    #[serde(default)]
    pub account_id: String,
    /// 密码 / Token（可能为 v1: 密文）
    #[serde(default)]
    pub access_key: String,
    /// 私钥（可能为 v1: 密文）
    #[serde(default)]
    pub secret_key: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub notes: String,
    pub updated_at: i64,
}

/// 列表返回：敏感字段脱敏
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

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn to_info(a: &PlatformAccount) -> PlatformAccountInfo {
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

fn encrypt_fields(
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

pub fn vault_status(app: &AppHandle, vault: &VaultState) -> VaultStatus {
    VaultStatus {
        configured: is_configured(app),
        unlocked: vault.is_unlocked(),
    }
}

pub fn vault_setup(app: &AppHandle, vault: &VaultState, password: String) -> Result<VaultStatus, String> {
    vault.setup(app, &password)?;
    // 迁移已有明文敏感字段
    migrate_plaintext(app, vault)?;
    Ok(vault_status(app, vault))
}

pub fn vault_unlock(app: &AppHandle, vault: &VaultState, password: String) -> Result<VaultStatus, String> {
    vault.unlock_with_password(app, password.trim())?;
    Ok(vault_status(app, vault))
}

pub fn vault_lock(vault: &VaultState) -> VaultStatus {
    vault.lock();
    VaultStatus {
        configured: true,
        unlocked: false,
    }
}

fn migrate_plaintext(app: &AppHandle, vault: &VaultState) -> Result<(), String> {
    let mut list = crate::persist::load_accounts(app);
    let mut changed = false;
    for a in &mut list {
        if !a.access_key.is_empty() && !is_encrypted(&a.access_key) {
            a.access_key = vault.encrypt_secret(&a.access_key)?;
            changed = true;
        }
        if !a.secret_key.is_empty() && !is_encrypted(&a.secret_key) {
            a.secret_key = vault.encrypt_secret(&a.secret_key)?;
            changed = true;
        }
    }
    if changed {
        crate::persist::save_accounts(app, &list);
    }
    Ok(())
}

pub fn list(app: &AppHandle) -> Vec<PlatformAccountInfo> {
    let mut list = crate::persist::load_accounts(app);
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list.iter().map(to_info).collect()
}

pub fn reveal(
    app: &AppHandle,
    vault: &VaultState,
    id: String,
) -> Result<RevealedSecrets, String> {
    if is_configured(app) && !vault.is_unlocked() {
        return Err("请先解锁保险柜".into());
    }
    let list = crate::persist::load_accounts(app);
    let a = list
        .iter()
        .find(|x| x.id == id)
        .ok_or_else(|| "账号不存在".to_string())?;
    Ok(RevealedSecrets {
        id: a.id.clone(),
        access_key: vault.decrypt_secret(&a.access_key)?,
        secret_key: vault.decrypt_secret(&a.secret_key)?,
    })
}

pub fn add(
    app: &AppHandle,
    vault: &VaultState,
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
    let name = name.trim().to_string();
    let platform = platform.trim().to_string();
    let phone = phone.trim().to_string();
    let email = email.trim().to_string();
    let account_id = account_id.trim().to_string();
    let access_key = access_key.trim().to_string();
    let secret_key = secret_key.trim().to_string();
    if platform.is_empty() {
        return Err("请填写平台".into());
    }
    if name.is_empty() {
        return Err("用户名不能为空".into());
    }
    if phone.is_empty() {
        return Err("手机号不能为空".into());
    }
    if email.is_empty() {
        return Err("邮箱不能为空".into());
    }
    if account_id.is_empty() {
        return Err("公钥不能为空".into());
    }
    if access_key.is_empty() {
        return Err("密码不能为空".into());
    }
    if secret_key.is_empty() {
        return Err("私钥不能为空".into());
    }

    let mut list = crate::persist::load_accounts(app);
    if list.iter().any(|a| a.name == name && a.platform == platform) {
        return Err(format!("该平台已存在同名用户「{name}」"));
    }

    let (access_key, secret_key) = encrypt_fields(vault, app, access_key, secret_key)?;

    let account = PlatformAccount {
        id: Uuid::new_v4().to_string(),
        name,
        platform,
        phone,
        email,
        account_id,
        access_key,
        secret_key,
        enabled,
        notes: notes.trim().to_string(),
        updated_at: now_ms(),
    };
    let info = to_info(&account);
    list.push(account);
    crate::persist::save_accounts(app, &list);
    Ok(info)
}

pub fn update(
    app: &AppHandle,
    vault: &VaultState,
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
    // true：用传入的 access/secret 覆盖；false：保留原密文（未解锁或不改密）
    update_secrets: bool,
) -> Result<PlatformAccountInfo, String> {
    let name = name.trim().to_string();
    let platform = platform.trim().to_string();
    if platform.is_empty() {
        return Err("请填写平台".into());
    }
    if name.is_empty() {
        return Err("用户名不能为空".into());
    }

    let mut list = crate::persist::load_accounts(app);
    if list
        .iter()
        .any(|a| a.name == name && a.platform == platform && a.id != id)
    {
        return Err(format!("该平台已存在同名用户「{name}」"));
    }

    let account = list
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| "账号不存在".to_string())?;
    account.name = name;
    account.platform = platform;
    account.phone = phone.trim().to_string();
    account.email = email.trim().to_string();
    account.account_id = account_id.trim().to_string();
    if update_secrets {
        let (ak, sk) = encrypt_fields(vault, app, access_key, secret_key)?;
        account.access_key = ak;
        account.secret_key = sk;
    }
    account.enabled = enabled;
    account.notes = notes.trim().to_string();
    account.updated_at = now_ms();
    let info = to_info(account);
    crate::persist::save_accounts(app, &list);
    Ok(info)
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = crate::persist::load_accounts(app);
    let before = list.len();
    list.retain(|a| a.id != id);
    if list.len() == before {
        return Err("账号不存在".into());
    }
    crate::persist::save_accounts(app, &list);
    Ok(())
}

/// 供 command 层方便取 State
pub type Vault<'a> = State<'a, VaultState>;
