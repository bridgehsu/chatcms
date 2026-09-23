use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::{CmsNote, CmsNoteGroup};
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

fn map_note(r: sqlx::sqlite::SqliteRow) -> CmsNote {
    CmsNote {
        id: r.get("id"),
        title: r.get("title"),
        content: r.get("content"),
        icon: r.get("icon"),
        group_id: r.get("group_id"),
        source_session_id: r.get("source_session_id"),
        source_session_title: r.get("source_session_title"),
        source_message_id: r.get("source_message_id"),
        knowledge_id: r.get("knowledge_id"),
        created_at: r.get("created"),
        updated_at: r.get("updated"),
    }
}

fn map_group(r: sqlx::sqlite::SqliteRow) -> CmsNoteGroup {
    CmsNoteGroup {
        id: r.get("id"),
        name: r.get("name"),
        sort_order: r.get("sort_order"),
        created_at: r.get("created"),
        updated_at: r.get("updated"),
    }
}

pub async fn load_notes(app: &AppHandle) -> Vec<CmsNote> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, title, content, icon, group_id, source_session_id, source_session_title,
                source_message_id, knowledge_id, created, updated
         FROM cms_note WHERE yn = 0 ORDER BY updated DESC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(map_note)
    .collect()
}

pub async fn load_groups(app: &AppHandle) -> Vec<CmsNoteGroup> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, name, sort_order, created, updated
         FROM cms_note_group WHERE yn = 0
         ORDER BY sort_order ASC, created ASC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(map_group)
    .collect()
}

pub async fn count_notes(app: &AppHandle) -> i64 {
    let p = pool(app);
    sqlx::query_scalar("SELECT COUNT(*) FROM cms_note WHERE yn = 0")
        .fetch_one(&p)
        .await
        .unwrap_or(0)
}

pub async fn save_note(app: &AppHandle, note: &CmsNote) -> Result<(), String> {
    let p = pool(app);
    sqlx::query(
        "INSERT INTO cms_note (
            id, title, content, icon, group_id, source_session_id, source_session_title,
            source_message_id, knowledge_id, yn, created, updated
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           icon = excluded.icon,
           group_id = excluded.group_id,
           source_session_id = excluded.source_session_id,
           source_session_title = excluded.source_session_title,
           source_message_id = excluded.source_message_id,
           knowledge_id = excluded.knowledge_id,
           yn = 0,
           updated = excluded.updated",
    )
    .bind(&note.id)
    .bind(&note.title)
    .bind(&note.content)
    .bind(&note.icon)
    .bind(&note.group_id)
    .bind(&note.source_session_id)
    .bind(&note.source_session_title)
    .bind(&note.source_message_id)
    .bind(&note.knowledge_id)
    .bind(note.created_at)
    .bind(note.updated_at)
    .execute(&p)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn soft_delete_note(app: &AppHandle, id: &str) -> Result<(), String> {
    let p = pool(app);
    let now = super::now_ms();
    sqlx::query("UPDATE cms_note SET yn = 1, updated = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(&p)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_note(app: &AppHandle, id: &str) -> Option<CmsNote> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, title, content, icon, group_id, source_session_id, source_session_title,
                source_message_id, knowledge_id, created, updated
         FROM cms_note WHERE id = ? AND yn = 0",
    )
    .bind(id)
    .fetch_optional(&p)
    .await
    .ok()
    .flatten()
    .map(map_note)
}

pub async fn list_by_message_id(app: &AppHandle, message_id: &str) -> Vec<CmsNote> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, title, content, icon, group_id, source_session_id, source_session_title,
                source_message_id, knowledge_id, created, updated
         FROM cms_note
         WHERE yn = 0 AND source_message_id = ?
         ORDER BY updated DESC",
    )
    .bind(message_id)
    .fetch_all(&p)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(map_note)
    .collect()
}

pub async fn count_notes_in_group(app: &AppHandle, group_id: &str) -> i64 {
    let p = pool(app);
    sqlx::query_scalar("SELECT COUNT(*) FROM cms_note WHERE yn = 0 AND group_id = ?")
        .bind(group_id)
        .fetch_one(&p)
        .await
        .unwrap_or(0)
}

pub async fn save_group(app: &AppHandle, g: &CmsNoteGroup) -> Result<(), String> {
    let p = pool(app);
    sqlx::query(
        "INSERT INTO cms_note_group (id, name, sort_order, yn, created, updated)
         VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           sort_order = excluded.sort_order,
           yn = 0,
           updated = excluded.updated",
    )
    .bind(&g.id)
    .bind(&g.name)
    .bind(g.sort_order)
    .bind(g.created_at)
    .bind(g.updated_at)
    .execute(&p)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn soft_delete_group(app: &AppHandle, id: &str) -> Result<(), String> {
    let p = pool(app);
    let now = super::now_ms();
    sqlx::query("UPDATE cms_note_group SET yn = 1, updated = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(&p)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn next_group_sort(app: &AppHandle) -> i64 {
    let p = pool(app);
    let max: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), -1) FROM cms_note_group WHERE yn = 0",
    )
    .fetch_one(&p)
    .await
    .unwrap_or(-1);
    max + 1
}

pub async fn clear_notes_group(app: &AppHandle, group_id: &str) -> Result<(), String> {
    let p = pool(app);
    let now = super::now_ms();
    sqlx::query("UPDATE cms_note SET group_id = NULL, updated = ? WHERE group_id = ? AND yn = 0")
        .bind(now)
        .bind(group_id)
        .execute(&p)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
