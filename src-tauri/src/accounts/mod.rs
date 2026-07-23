use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformAccount {
    pub id: String,
    /// 备注名，如「品牌官号 / 个人号」
    pub name: String,
    /// 平台 id：wechat_mp / xiaohongshu / …
    pub platform: String,
    /// 平台侧账号标识（AppID / open_id / 用户名等）
    #[serde(default)]
    pub account_id: String,
    /// 主密钥（Access Token / AppKey / Bot Token）
    #[serde(default)]
    pub access_key: String,
    /// 辅密钥（AppSecret / Refresh Token）
    #[serde(default)]
    pub secret_key: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub notes: String,
    pub updated_at: i64,
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

pub fn list(app: &AppHandle) -> Vec<PlatformAccount> {
    let mut list = crate::persist::load_accounts(app);
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list
}

pub fn add(
    app: &AppHandle,
    name: String,
    platform: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
) -> Result<PlatformAccount, String> {
    let name = name.trim().to_string();
    let platform = platform.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    if platform.is_empty() {
        return Err("请选择平台".into());
    }

    let mut list = crate::persist::load_accounts(app);
    if list.iter().any(|a| a.name == name && a.platform == platform) {
        return Err(format!("该平台已存在同名账号「{name}」"));
    }

    let account = PlatformAccount {
        id: Uuid::new_v4().to_string(),
        name,
        platform,
        account_id: account_id.trim().to_string(),
        access_key,
        secret_key,
        enabled,
        notes: notes.trim().to_string(),
        updated_at: now_ms(),
    };
    list.push(account.clone());
    crate::persist::save_accounts(app, &list);
    Ok(account)
}

pub fn update(
    app: &AppHandle,
    id: String,
    name: String,
    platform: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
) -> Result<PlatformAccount, String> {
    let name = name.trim().to_string();
    let platform = platform.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    if platform.is_empty() {
        return Err("请选择平台".into());
    }

    let mut list = crate::persist::load_accounts(app);
    if list
        .iter()
        .any(|a| a.name == name && a.platform == platform && a.id != id)
    {
        return Err(format!("该平台已存在同名账号「{name}」"));
    }

    let account = list
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| "账号不存在".to_string())?;
    account.name = name;
    account.platform = platform;
    account.account_id = account_id.trim().to_string();
    account.access_key = access_key;
    account.secret_key = secret_key;
    account.enabled = enabled;
    account.notes = notes.trim().to_string();
    account.updated_at = now_ms();
    let out = account.clone();
    crate::persist::save_accounts(app, &list);
    Ok(out)
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
