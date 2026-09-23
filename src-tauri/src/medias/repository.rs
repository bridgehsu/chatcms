//! 媒体平台 / 发布·采集脚本：SQLite 持久化（数据根目录 chatcms.db）。
//! 同步包装层供现有 sync service / 桥调用；内部为 async sqlx。

use std::future::Future;
use std::sync::Arc;

use sqlx::Row;
use tauri::{AppHandle, Manager};
use tauri_plugin_store::{Store, StoreBuilder};

use super::{MediaPlatform, PublishScript};
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

fn block_on<T>(fut: impl Future<Output = T>) -> T {
    tokio::task::block_in_place(|| match tokio::runtime::Handle::try_current() {
        Ok(h) => h.block_on(fut),
        Err(_) => tauri::async_runtime::block_on(fut),
    })
}

fn map_platform(r: sqlx::sqlite::SqliteRow) -> MediaPlatform {
    let enabled: i64 = r.get("enabled");
    let region: String = r.try_get("region").unwrap_or_else(|_| "cn".into());
    MediaPlatform {
        id: r.get("id"),
        code: r.get("code"),
        name: r.get("name"),
        kind: r.get("kind"),
        inject_url: r.get("inject_url"),
        home_url: r.get("home_url"),
        enabled: enabled != 0,
        notes: r.get("notes"),
        region: if region.trim().is_empty() {
            "cn".into()
        } else {
            region
        },
        updated_at: r.get("updated"),
    }
}

fn map_script(r: sqlx::sqlite::SqliteRow) -> PublishScript {
    let ver: i64 = r.get("published_version");
    PublishScript {
        id: r.get("id"),
        platform_id: r.get("platform_id"),
        kind: r.get("kind"),
        draft_script: r.get("draft_script"),
        published_script: r.get("published_script"),
        published_version: ver.max(0) as u32,
        match_url: r.get("match_url"),
        changelog: r.get("changelog"),
        updated_at: r.get("updated"),
    }
}

// ── platforms ──────────────────────────────────────────────

pub async fn load_platforms_async(app: &AppHandle) -> Vec<MediaPlatform> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, code, name, kind, inject_url, home_url, enabled, notes, region, updated
         FROM media_platform",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(map_platform)
    .collect()
}

pub async fn save_platforms_async(app: &AppHandle, platforms: &[MediaPlatform]) -> Result<(), String> {
    let p = pool(app);
    let mut tx = p.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM media_platform")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    for item in platforms {
        sqlx::query(
            "INSERT INTO media_platform
               (id, code, name, kind, inject_url, home_url, enabled, notes, region, updated)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&item.id)
        .bind(&item.code)
        .bind(&item.name)
        .bind(&item.kind)
        .bind(&item.inject_url)
        .bind(&item.home_url)
        .bind(if item.enabled { 1i64 } else { 0i64 })
        .bind(&item.notes)
        .bind(&item.region)
        .bind(item.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())
}

pub fn load_platforms(app: &AppHandle) -> Vec<MediaPlatform> {
    block_on(load_platforms_async(app))
}

pub fn save_platforms(app: &AppHandle, platforms: &[MediaPlatform]) {
    let _ = block_on(save_platforms_async(app, platforms));
}

// ── publish scripts ────────────────────────────────────────

const PUBLISH_SELECT: &str = "SELECT id, platform_id, kind, draft_script, published_script,
        published_version, match_url, changelog, updated
 FROM media_publish_script";

const COLLECT_SELECT: &str = "SELECT id, platform_id, kind, draft_script, published_script,
        published_version, match_url, changelog, updated
 FROM media_collect_script";

pub async fn load_publish_scripts_async(app: &AppHandle) -> Vec<PublishScript> {
    let p = pool(app);
    sqlx::query(PUBLISH_SELECT)
        .fetch_all(&p)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(map_script)
        .collect()
}

pub async fn save_publish_scripts_async(
    app: &AppHandle,
    scripts: &[PublishScript],
) -> Result<(), String> {
    replace_scripts(app, "media_publish_script", scripts).await
}

pub fn load_publish_scripts(app: &AppHandle) -> Vec<PublishScript> {
    block_on(load_publish_scripts_async(app))
}

pub fn save_publish_scripts(app: &AppHandle, scripts: &[PublishScript]) {
    let _ = block_on(save_publish_scripts_async(app, scripts));
}

// ── collect scripts ────────────────────────────────────────

pub async fn load_collect_scripts_async(app: &AppHandle) -> Vec<PublishScript> {
    let p = pool(app);
    sqlx::query(COLLECT_SELECT)
        .fetch_all(&p)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(map_script)
        .collect()
}

pub async fn save_collect_scripts_async(
    app: &AppHandle,
    scripts: &[PublishScript],
) -> Result<(), String> {
    replace_scripts(app, "media_collect_script", scripts).await
}

pub fn load_collect_scripts(app: &AppHandle) -> Vec<PublishScript> {
    block_on(load_collect_scripts_async(app))
}

pub fn save_collect_scripts(app: &AppHandle, scripts: &[PublishScript]) {
    let _ = block_on(save_collect_scripts_async(app, scripts));
}

async fn replace_scripts(
    app: &AppHandle,
    table: &str,
    scripts: &[PublishScript],
) -> Result<(), String> {
    let p = pool(app);
    let mut tx = p.begin().await.map_err(|e| e.to_string())?;
    let del = format!("DELETE FROM {table}");
    sqlx::query(&del)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let ins = format!(
        "INSERT INTO {table}
           (id, platform_id, kind, draft_script, published_script,
            published_version, match_url, changelog, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for item in scripts {
        sqlx::query(&ins)
            .bind(&item.id)
            .bind(&item.platform_id)
            .bind(&item.kind)
            .bind(&item.draft_script)
            .bind(&item.published_script)
            .bind(item.published_version as i64)
            .bind(&item.match_url)
            .bind(&item.changelog)
            .bind(item.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())
}

// ── legacy JSON store migration ────────────────────────────

fn open_store(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, "chatcms.json").build().ok()
}

fn load_legacy_platforms(app: &AppHandle) -> Vec<MediaPlatform> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get("media_platforms")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn load_legacy_scripts(app: &AppHandle, key: &str) -> Vec<PublishScript> {
    let Some(store) = open_store(app) else {
        return vec![];
    };
    store
        .get(key)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn remap_scripts(
    scripts: Vec<PublishScript>,
    legacy_platforms: &[MediaPlatform],
    current_platforms: &[MediaPlatform],
) -> Vec<PublishScript> {
    let legacy_id_to_code: std::collections::HashMap<&str, &str> = legacy_platforms
        .iter()
        .map(|p| (p.id.as_str(), p.code.as_str()))
        .collect();
    let code_to_id: std::collections::HashMap<&str, &str> = current_platforms
        .iter()
        .map(|p| (p.code.as_str(), p.id.as_str()))
        .collect();

    scripts
        .into_iter()
        .filter_map(|mut s| {
            if current_platforms.iter().any(|p| p.id == s.platform_id) {
                return Some(s);
            }
            let code = legacy_id_to_code.get(s.platform_id.as_str())?;
            let new_id = code_to_id.get(code)?;
            s.platform_id = (*new_id).to_string();
            Some(s)
        })
        .collect()
}

/// 将旧 `chatcms.json` 中的媒体平台/脚本迁入 SQLite（仅当对应表为空时）。
pub async fn migrate_from_legacy_store(app: &AppHandle) {
    let legacy_platforms = load_legacy_platforms(app);
    let legacy_publish = load_legacy_scripts(app, "publish_scripts");
    let legacy_collect = load_legacy_scripts(app, "collect_scripts");

    let mut platforms = load_platforms_async(app).await;
    if platforms.is_empty() && !legacy_platforms.is_empty() {
        if let Err(e) = save_platforms_async(app, &legacy_platforms).await {
            log::warn!(target: "chatcms_lib::medias", "migrate platforms failed: {e}");
        } else {
            platforms = legacy_platforms.clone();
            log::info!(
                target: "chatcms_lib::medias",
                "migrated {} media platforms from chatcms.json",
                platforms.len()
            );
        }
    }

    let pubs = load_publish_scripts_async(app).await;
    if pubs.is_empty() && !legacy_publish.is_empty() {
        let mapped = remap_scripts(legacy_publish, &legacy_platforms, &platforms);
        if !mapped.is_empty() {
            if let Err(e) = save_publish_scripts_async(app, &mapped).await {
                log::warn!(target: "chatcms_lib::medias", "migrate publish scripts failed: {e}");
            } else {
                log::info!(
                    target: "chatcms_lib::medias",
                    "migrated {} publish scripts from chatcms.json",
                    mapped.len()
                );
            }
        }
    }

    let cols = load_collect_scripts_async(app).await;
    if cols.is_empty() && !legacy_collect.is_empty() {
        let mapped = remap_scripts(legacy_collect, &legacy_platforms, &platforms);
        if !mapped.is_empty() {
            if let Err(e) = save_collect_scripts_async(app, &mapped).await {
                log::warn!(target: "chatcms_lib::medias", "migrate collect scripts failed: {e}");
            } else {
                log::info!(
                    target: "chatcms_lib::medias",
                    "migrated {} collect scripts from chatcms.json",
                    mapped.len()
                );
            }
        }
    }
}
