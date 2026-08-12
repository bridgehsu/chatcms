use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::db::DbPool;
use crate::images::GeneratedImage;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

pub async fn save_image(app: &AppHandle, image: &GeneratedImage) {
    let p = pool(app);
    let _ = sqlx::query(
        "INSERT INTO images (id, prompt, model, size, path, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           prompt     = excluded.prompt,
           model      = excluded.model,
           size       = excluded.size,
           path       = excluded.path,
           note       = excluded.note,
           updated_at = excluded.updated_at",
    )
    .bind(&image.id)
    .bind(&image.prompt)
    .bind(&image.model)
    .bind(&image.size)
    .bind(&image.path)
    .bind(&image.note)
    .bind(image.created_at)
    .bind(image.updated_at)
    .execute(&p)
    .await;
}

pub async fn delete_image(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM images WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

pub async fn load_all_images(app: &AppHandle) -> Vec<GeneratedImage> {
    let p = pool(app);
    sqlx::query(
        "SELECT id, prompt, model, size, path, note, created_at, updated_at
         FROM images ORDER BY created_at DESC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| GeneratedImage {
        id: r.get("id"),
        prompt: r.get("prompt"),
        model: r.get("model"),
        size: r.get("size"),
        path: r.get("path"),
        note: r.get("note"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    })
    .collect()
}
