use tauri::AppHandle;
use uuid::Uuid;

use super::{NavBookmark, now_ms, normalize_url};
use super::repository as repo;

pub fn list(app: &AppHandle) -> Vec<NavBookmark> {
    let mut list = repo::load_all(app);
    list.sort_by(|a, b| {
        a.sort_order
            .cmp(&b.sort_order)
            .then_with(|| b.updated_at.cmp(&a.updated_at))
            .then_with(|| a.title.cmp(&b.title))
    });
    list
}

pub fn upsert_raw(
    app: &AppHandle,
    id: Option<String>,
    title: String,
    url: String,
    note: String,
    sort_order: Option<i32>,
    section: Option<String>,
) -> Result<NavBookmark, String> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err("名称不能为空".into());
    }
    let url = url.trim().to_string();
    if url.is_empty() {
        return Err("路径不能为空".into());
    }
    upsert_inner(app, id, title, url, note, sort_order, section)
}

pub fn upsert(
    app: &AppHandle,
    id: Option<String>,
    title: String,
    url: String,
    note: String,
    sort_order: Option<i32>,
    section: Option<String>,
) -> Result<NavBookmark, String> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err("名称不能为空".into());
    }
    let url = normalize_url(&url)?;
    upsert_inner(app, id, title, url, note, sort_order, section)
}

fn upsert_inner(
    app: &AppHandle,
    id: Option<String>,
    title: String,
    url: String,
    note: String,
    sort_order: Option<i32>,
    section: Option<String>,
) -> Result<NavBookmark, String> {
    let note = note.trim().to_string();
    let mut list = repo::load_all(app);
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
        if section.is_some() {
            item.section = section;
        }
        item.updated_at = ts;
        let updated = item.clone();
        repo::save(app, &list);
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
            section,
        };
        list.push(bookmark.clone());
        repo::save(app, &list);
        Ok(bookmark)
    }
}

pub fn list_by_section(app: &AppHandle, section: Option<String>) -> Vec<NavBookmark> {
    let mut list = repo::load_all(app);
    list.retain(|b| b.section == section);
    list.sort_by(|a, b| {
        a.sort_order
            .cmp(&b.sort_order)
            .then_with(|| b.updated_at.cmp(&a.updated_at))
    });
    list
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = repo::load_all(app);
    let before = list.len();
    list.retain(|b| b.id != id);
    if list.len() == before {
        return Err("导航项不存在".into());
    }
    repo::save(app, &list);
    Ok(())
}
