//! 导航书签：扩展「导航」Tab 与桌面同源。

pub mod commands;
pub mod repository;

mod service;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavBookmark {
    pub id: String,
    pub title: String,
    pub url: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub sort_order: i32,
    pub updated_at: i64,
    #[serde(default)]
    pub section: Option<String>,
}

pub(crate) fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn normalize_url(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("链接不能为空".into());
    }
    let with_scheme = if s.starts_with("http://") || s.starts_with("https://") {
        s.to_string()
    } else {
        format!("https://{s}")
    };
    if !(with_scheme.starts_with("http://") || with_scheme.starts_with("https://")) {
        return Err("仅支持 http/https 链接".into());
    }
    let rest = with_scheme
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    if rest.is_empty() || rest.contains(' ') {
        return Err("链接格式无效".into());
    }
    Ok(with_scheme)
}

pub use service::{list, upsert, upsert_raw, list_by_section, remove};
