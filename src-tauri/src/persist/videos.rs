use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::db::DbPool;
use crate::videos::GeneratedVideo;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

pub async fn save_video(app: &AppHandle, video: &GeneratedVideo) {
    let p = pool(app);
    let _ = sqlx::query(
        "INSERT INTO videos (id, prompt, model, size, seconds, path, remote_id, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           prompt     = excluded.prompt,
           model      = excluded.model,
           size       = excluded.size,
           seconds    = excluded.seconds,
           path       = excluded.path,
           remote_id  = excluded.remote_id,
           note       = excluded.note,
           updated_at = excluded.updated_at",
    )
    .bind(&video.id)
    .bind(&video.prompt)
    .bind(&video.model)
    .bind(&video.size)
    .bind(&video.seconds)
    .bind(&video.path)
    .bind(&video.remote_id)
    .bind(&video.note)
    .bind(video.created_at)
    .bind(video.updated_at)
    .execute(&p)
    .await;
}

pub async fn delete_video(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM videos WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

pub async fn load_all_videos(app: &AppHandle) -> Vec<GeneratedVideo> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, prompt, model, size, seconds, path, remote_id, note, created_at, updated_at
         FROM videos ORDER BY created_at DESC",
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
        note: r.get("note"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    })
    .collect()
}
