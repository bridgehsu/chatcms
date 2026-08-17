use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::GeneratedVideo;
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

pub async fn save(app: &AppHandle, video: &GeneratedVideo) {
    let p = pool(app);
    let _ = sqlx::query(
        "INSERT INTO videos (id, prompt, model, size, seconds, path, remote_id, remark, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           prompt    = excluded.prompt,
           model     = excluded.model,
           size      = excluded.size,
           seconds   = excluded.seconds,
           path      = excluded.path,
           remote_id = excluded.remote_id,
           remark    = excluded.remark,
           updated   = excluded.updated",
    )
    .bind(&video.id)
    .bind(&video.prompt)
    .bind(&video.model)
    .bind(&video.size)
    .bind(&video.seconds)
    .bind(&video.path)
    .bind(&video.remote_id)
    .bind(&video.remark)
    .bind(video.created)
    .bind(video.updated)
    .execute(&p)
    .await;
}

pub async fn delete(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM videos WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

pub async fn load_all(app: &AppHandle) -> Vec<GeneratedVideo> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, prompt, model, size, seconds, path, remote_id, remark, created, updated
         FROM videos ORDER BY created DESC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| GeneratedVideo {
        id: r.get("id"),
        prompt: r.get("prompt"),
        model: r.get("model"),
        size: r.get("size"),
        seconds: r.get("seconds"),
        path: r.get("path"),
        remote_id: r.get("remote_id"),
        remark: r.get("remark"),
        created: r.get("created"),
        updated: r.get("updated"),
    })
    .collect()
}
