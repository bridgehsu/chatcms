use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::ProviderProfile;
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

fn parse_json_obj(s: &str) -> serde_json::Value {
    serde_json::from_str(s).unwrap_or_else(|_| serde_json::Value::Object(Default::default()))
}

fn parse_json_vec(s: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(s).unwrap_or_default()
}

fn row_to_profile(r: sqlx::sqlite::SqliteRow) -> ProviderProfile {
    let enabled: i64 = r.get("enabled");
    let thinking: i64 = r.try_get("thinking").unwrap_or(0);

    let capabilities_str: String = r.try_get("capabilities").unwrap_or_else(|_| "{}".into());
    let extra_body_str: String = r.try_get("extra_body").unwrap_or_else(|_| "{}".into());
    let tags_str: String = r.try_get("tags").unwrap_or_else(|_| "[]".into());

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
        capabilities: parse_json_obj(&capabilities_str),
        thinking: thinking != 0,
        thinking_effort: r.try_get("thinking_effort").unwrap_or_else(|_| "medium".into()),
        temperature: r.try_get("temperature").unwrap_or(None),
        max_output_tokens: r.try_get("max_output_tokens").unwrap_or(None),
        extra_body: parse_json_obj(&extra_body_str),
        tags: parse_json_vec(&tags_str),
    }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

pub async fn list(app: &AppHandle) -> Vec<ProviderProfile> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, name, kind, api_key, model, base_url, tier, weight, context_window,
                enabled, created, updated,
                capabilities, thinking, thinking_effort, temperature, max_output_tokens,
                extra_body, tags
         FROM model_profile
         ORDER BY weight DESC, created ASC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    rows.into_iter().map(row_to_profile).collect()
}

pub async fn get(app: &AppHandle, id: &str) -> Option<ProviderProfile> {
    let p = pool(app);
    let row = sqlx::query(
        "SELECT id, name, kind, api_key, model, base_url, tier, weight, context_window,
                enabled, created, updated,
                capabilities, thinking, thinking_effort, temperature, max_output_tokens,
                extra_body, tags
         FROM model_profile WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&p)
    .await
    .ok()??;

    Some(row_to_profile(row))
}

pub async fn insert(app: &AppHandle, p: &ProviderProfile) -> Result<(), String> {
    let pool = pool(app);
    let capabilities = p.capabilities.to_string();
    let extra_body = p.extra_body.to_string();
    let tags = serde_json::to_string(&p.tags).unwrap_or_else(|_| "[]".into());

    sqlx::query(
        "INSERT INTO model_profile
         (id, name, kind, api_key, model, base_url, tier, weight, context_window,
          enabled, created, updated,
          capabilities, thinking, thinking_effort, temperature, max_output_tokens,
          extra_body, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    .bind(&capabilities)
    .bind(p.thinking as i64)
    .bind(&p.thinking_effort)
    .bind(p.temperature)
    .bind(p.max_output_tokens)
    .bind(&extra_body)
    .bind(&tags)
    .execute(&pool)
    .await
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub async fn update(app: &AppHandle, p: &ProviderProfile) {
    let pool = pool(app);
    let capabilities = p.capabilities.to_string();
    let extra_body = p.extra_body.to_string();
    let tags = serde_json::to_string(&p.tags).unwrap_or_else(|_| "[]".into());

    let _ = sqlx::query(
        "UPDATE model_profile SET
           name             = ?,
           kind             = ?,
           api_key          = ?,
           model            = ?,
           base_url         = ?,
           tier             = ?,
           weight           = ?,
           context_window   = ?,
           enabled          = ?,
           updated          = ?,
           capabilities     = ?,
           thinking         = ?,
           thinking_effort  = ?,
           temperature      = ?,
           max_output_tokens = ?,
           extra_body       = ?,
           tags             = ?
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
    .bind(&capabilities)
    .bind(p.thinking as i64)
    .bind(&p.thinking_effort)
    .bind(p.temperature)
    .bind(p.max_output_tokens)
    .bind(&extra_body)
    .bind(&tags)
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
