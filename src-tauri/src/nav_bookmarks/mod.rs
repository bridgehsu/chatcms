//! 导航书签：扩展「导航」Tab 与桌面同源。

pub mod commands;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

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
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn normalize_url(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("链接不能为空".into());
    }
    let with_scheme = if s.starts_with("http://") || s.starts_with("https://") {
        s.to_string()
    } else {
        format!("https://{s}")
    };
    // 轻量校验，避免引入额外依赖
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

pub fn list(app: &AppHandle) -> Vec<NavBookmark> {
    let mut list = crate::persist::load_nav_bookmarks(app);
    list.sort_by(|a, b| {
        a.sort_order
            .cmp(&b.sort_order)
            .then_with(|| b.updated_at.cmp(&a.updated_at))
            .then_with(|| a.title.cmp(&b.title))
    });
    list
}

pub fn upsert(
    app: &AppHandle,
    id: Option<String>,
    title: String,
    url: String,
    note: String,
    sort_order: Option<i32>,
) -> Result<NavBookmark, String> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err("名称不能为空".into());
    }
    let url = normalize_url(&url)?;
    let note = note.trim().to_string();
    let mut list = crate::persist::load_nav_bookmarks(app);
    let ts = now_ms();

    if let Some(bid) = id.filter(|s| !s.trim().is_empty()) {
        let Some(item) = list.iter_mut().find(|b| b.id == bid) else {
            return Err("导航项不存在".into());
        };
        item.title = title;
        item.url = url;
        item.note = note;
        if let Some(ord) = sort_order {
            item.sort_order = ord;
        }
        item.updated_at = ts;
        let updated = item.clone();
        crate::persist::save_nav_bookmarks(app, &list);
        Ok(updated)
    } else {
        let ord = sort_order.unwrap_or_else(|| {
            list.iter()
                .map(|b| b.sort_order)
                .max()
                .map(|m| m + 1)
                .unwrap_or(0)
        });
        let bookmark = NavBookmark {
            id: Uuid::new_v4().to_string(),
            title,
            url,
            note,
            sort_order: ord,
            updated_at: ts,
        };
        list.push(bookmark.clone());
        crate::persist::save_nav_bookmarks(app, &list);
        Ok(bookmark)
    }
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = crate::persist::load_nav_bookmarks(app);
    let before = list.len();
    list.retain(|b| b.id != id);
    if list.len() == before {
        return Err("导航项不存在".into());
    }
    crate::persist::save_nav_bookmarks(app, &list);
    Ok(())
}
