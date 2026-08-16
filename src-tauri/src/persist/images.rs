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
        "INSERT INTO images (id, prompt, model, size, path, remark, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           prompt  = excluded.prompt,
           model   = excluded.model,
           size    = excluded.size,
           path    = excluded.path,
           remark  = excluded.remark,
           updated = excluded.updated",
    )
    .bind(&image.id)
    .bind(&image.prompt)
    .bind(&image.model)
    .bind(&image.size)
    .bind(&image.path)
    .bind(&image.remark)
    .bind(image.created)
    .bind(image.updated)
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
        "SELECT id, prompt, model, size, path, remark, created, updated
         FROM images ORDER BY created DESC",
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
        remark: r.get("remark"),
        created: r.get("created"),
        updated: r.get("updated"),
    })
    .collect()
}
