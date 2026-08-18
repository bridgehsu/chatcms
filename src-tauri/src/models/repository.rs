use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::ProviderProfile;
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

pub async fn list(app: &AppHandle) -> Vec<ProviderProfile> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, name, kind, api_key, model, base_url, tier, weight, context_window,
                enabled, created, updated
         FROM model_profile
         ORDER BY weight DESC, created ASC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    rows.into_iter().map(|r| {
        let enabled: i64 = r.get("enabled");
        ProviderProfile {
            id: r.get("id"),
            name: r.get("name"),
            kind: r.get("kind"),
            api_key: r.get("api_key"),
            model: r.get("model"),
            base_url: r.get("base_url"),
            tier: r.get("tier"),
            weight: r.get("weight"),
            context_window: r.get("context_window"),
            enabled: enabled != 0,
            created: r.get("created"),
            updated: r.get("updated"),
        }
    }).collect()
}

pub async fn get(app: &AppHandle, id: &str) -> Option<ProviderProfile> {
    let p = pool(app);
    let row = sqlx::query(
        "SELECT id, name, kind, api_key, model, base_url, tier, weight, context_window,
                enabled, created, updated
         FROM model_profile WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&p)
    .await
    .ok()??;

    let enabled: i64 = row.get("enabled");
    Some(ProviderProfile {
        id: row.get("id"),
        name: row.get("name"),
        kind: row.get("kind"),
        api_key: row.get("api_key"),
        model: row.get("model"),
        base_url: row.get("base_url"),
        tier: row.get("tier"),
        weight: row.get("weight"),
        context_window: row.get("context_window"),
        enabled: enabled != 0,
        created: row.get("created"),
        updated: row.get("updated"),
    })
}

pub async fn insert(app: &AppHandle, p: &ProviderProfile) {
    let pool = pool(app);
    let _ = sqlx::query(
        "INSERT INTO model_profile
         (id, name, kind, api_key, model, base_url, tier, weight, context_window,
          enabled, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&p.id)
    .bind(&p.name)
    .bind(&p.kind)
    .bind(&p.api_key)
    .bind(&p.model)
    .bind(&p.base_url)
    .bind(&p.tier)
    .bind(p.weight)
    .bind(p.context_window)
    .bind(p.enabled as i64)
    .bind(p.created)
    .bind(p.updated)
    .execute(&pool)
    .await;
}

pub async fn update(app: &AppHandle, p: &ProviderProfile) {
    let pool = pool(app);
    let _ = sqlx::query(
        "UPDATE model_profile SET
           name           = ?,
           kind           = ?,
           api_key        = ?,
           model          = ?,
           base_url       = ?,
           tier           = ?,
           weight         = ?,
           context_window = ?,
           enabled        = ?,
           updated        = ?
         WHERE id = ?",
    )
    .bind(&p.name)
    .bind(&p.kind)
    .bind(&p.api_key)
    .bind(&p.model)
    .bind(&p.base_url)
    .bind(&p.tier)
    .bind(p.weight)
    .bind(p.context_window)
    .bind(p.enabled as i64)
    .bind(p.updated)
    .bind(&p.id)
    .execute(&pool)
    .await;
}

pub async fn remove(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM model_profile WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}
