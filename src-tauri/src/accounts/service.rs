use tauri::AppHandle;
use uuid::Uuid;

use super::{PlatformAccount, PlatformAccountInfo, RevealedSecrets, VaultStatus, now_ms, to_info, encrypt_fields};
use super::vault::{VaultState, is_configured};
use super::repository as repo;

pub fn vault_status(app: &AppHandle, vault: &VaultState) -> VaultStatus {
    VaultStatus {
        configured: is_configured(app),
        unlocked: vault.is_unlocked(),
    }
}

pub fn vault_setup(app: &AppHandle, vault: &VaultState, password: String) -> Result<VaultStatus, String> {
    vault.setup(app, &password)?;
    migrate_plaintext(app, vault)?;
    Ok(vault_status(app, vault))
}

pub fn vault_unlock(app: &AppHandle, vault: &VaultState, password: String) -> Result<VaultStatus, String> {
    vault.unlock_with_password(app, password.trim())?;
    Ok(vault_status(app, vault))
}

#[allow(dead_code)]
pub fn vault_lock(_app: &AppHandle, vault: &VaultState) -> VaultStatus {
    vault.lock();
    VaultStatus {
        configured: true,
        unlocked: false,
    }
}

fn migrate_plaintext(app: &AppHandle, vault: &VaultState) -> Result<(), String> {
    use super::vault::is_encrypted;
    let mut list = repo::load_accounts(app);
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
        repo::save_accounts(app, &list);
    }
    Ok(())
}

pub fn list(app: &AppHandle) -> Vec<PlatformAccountInfo> {
    let mut list = repo::load_accounts(app);
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
    let list = repo::load_accounts(app);
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

    let mut list = repo::load_accounts(app);
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
    repo::save_accounts(app, &list);
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

    let mut list = repo::load_accounts(app);
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
    repo::save_accounts(app, &list);
    Ok(info)
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = repo::load_accounts(app);
    let before = list.len();
    list.retain(|a| a.id != id);
    if list.len() == before {
        return Err("账号不存在".into());
    }
    repo::save_accounts(app, &list);
    Ok(())
}
