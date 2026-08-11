//! 账号保险柜：主密码派生密钥 + AES-256-GCM 加密敏感字段。

use std::sync::Mutex;
use std::time::{Duration, Instant};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const PREFIX: &str = "v1:";
const VERIFIER_PLAIN: &[u8] = b"chatcms-vault-ok";
const UNLOCK_TTL: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultMeta {
    /// Argon2 salt (base64)
    #[serde(default)]
    pub salt_b64: String,
    /// 用于校验主密码的密文 (v1:…)
    #[serde(default)]
    pub verifier: String,
}

#[derive(Default)]
struct VaultInner {
    key: Option<[u8; 32]>,
    unlocked_at: Option<Instant>,
}

pub struct VaultState {
    inner: Mutex<VaultInner>,
}

impl Default for VaultState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(VaultInner::default()),
        }
    }
}

impl VaultState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_unlocked(&self) -> bool {
        let mut g = self.inner.lock().unwrap();
        if let Some(at) = g.unlocked_at {
            if at.elapsed() > UNLOCK_TTL {
                g.key = None;
                g.unlocked_at = None;
                return false;
            }
            return g.key.is_some();
        }
        false
    }

    pub fn lock(&self) {
        let mut g = self.inner.lock().unwrap();
        g.key = None;
        g.unlocked_at = None;
    }

    fn touch(&self) {
        let mut g = self.inner.lock().unwrap();
        if g.key.is_some() {
            g.unlocked_at = Some(Instant::now());
        }
    }

    fn with_key<T>(&self, f: impl FnOnce(&[u8; 32]) -> Result<T, String>) -> Result<T, String> {
        if !self.is_unlocked() {
            return Err("保险柜已锁定，请先输入主密码解锁".into());
        }
        self.touch();
        let g = self.inner.lock().unwrap();
        let key = g.key.as_ref().ok_or_else(|| "保险柜已锁定".to_string())?;
        f(key)
    }

    pub fn unlock_with_password(&self, app: &AppHandle, password: &str) -> Result<(), String> {
        let meta = load_meta(app);
        if meta.salt_b64.is_empty() || meta.verifier.is_empty() {
            return Err("尚未设置主密码".into());
        }
        let salt = B64
            .decode(meta.salt_b64.as_bytes())
            .map_err(|e| format!("盐无效: {e}"))?;
        let key = derive_key(password, &salt)?;
        let plain = decrypt(&key, &meta.verifier)?;
        if plain != VERIFIER_PLAIN {
            return Err("主密码错误".into());
        }
        let mut g = self.inner.lock().unwrap();
        g.key = Some(key);
        g.unlocked_at = Some(Instant::now());
        Ok(())
    }

    pub fn setup(&self, app: &AppHandle, password: &str) -> Result<(), String> {
        let password = password.trim();
        if password.len() < 6 {
            return Err("主密码至少 6 位".into());
        }
        let existing = load_meta(app);
        if !existing.salt_b64.is_empty() {
            return Err("主密码已设置，请先解锁后使用".into());
        }
        let mut salt = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut salt);
        let key = derive_key(password, &salt)?;
        let verifier = encrypt(&key, VERIFIER_PLAIN)?;
        let meta = VaultMeta {
            salt_b64: B64.encode(salt),
            verifier,
        };
        save_meta(app, &meta);

        let mut g = self.inner.lock().unwrap();
        g.key = Some(key);
        g.unlocked_at = Some(Instant::now());
        Ok(())
    }

    pub fn encrypt_secret(&self, plain: &str) -> Result<String, String> {
        if plain.is_empty() {
            return Ok(String::new());
        }
        if is_encrypted(plain) {
            return Ok(plain.to_string());
        }
        self.with_key(|key| encrypt(key, plain.as_bytes()))
    }

    pub fn decrypt_secret(&self, stored: &str) -> Result<String, String> {
        if stored.is_empty() {
            return Ok(String::new());
        }
        if !is_encrypted(stored) {
            return Ok(stored.to_string());
        }
        self.with_key(|key| {
            let bytes = decrypt(key, stored)?;
            String::from_utf8(bytes).map_err(|e| format!("解密结果非 UTF-8: {e}"))
        })
    }
}

pub fn is_configured(app: &AppHandle) -> bool {
    let meta = load_meta(app);
    !meta.salt_b64.is_empty() && !meta.verifier.is_empty()
}

pub fn is_encrypted(value: &str) -> bool {
    value.starts_with(PREFIX)
}

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let argon2 = Argon2::default();
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("派生密钥失败: {e}"))?;
    Ok(key)
}

fn encrypt(key: &[u8; 32], plain: &[u8]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plain)
        .map_err(|e| format!("加密失败: {e}"))?;
    let mut out = Vec::with_capacity(12 + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    Ok(format!("{PREFIX}{}", B64.encode(out)))
}

fn decrypt(key: &[u8; 32], stored: &str) -> Result<Vec<u8>, String> {
    let raw = stored
        .strip_prefix(PREFIX)
        .ok_or_else(|| "密文格式无效".to_string())?;
    let bytes = B64
        .decode(raw.as_bytes())
        .map_err(|e| format!("密文解码失败: {e}"))?;
    if bytes.len() < 13 {
        return Err("密文过短".into());
    }
    let (nonce_bytes, ct) = bytes.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ct)
        .map_err(|_| "解密失败（主密码错误或数据损坏）".into())
}

fn load_meta(app: &AppHandle) -> VaultMeta {
    crate::persist::load_vault_meta(app)
}

fn save_meta(app: &AppHandle, meta: &VaultMeta) {
    crate::persist::save_vault_meta(app, meta);
}
