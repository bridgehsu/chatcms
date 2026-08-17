use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::{Skill, SkillSource};
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

pub async fn save(app: &AppHandle, skill: &Skill) {
    let p = pool(app);
    let source = format!("{:?}", skill.source).to_lowercase();
    let _ = sqlx::query(
        "INSERT INTO skill_pkg
         (id, name, description, emoji, body, file_path, source, pkg_name, homepage,
          enabled, user_invocable, disable_model_invocation, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name                     = excluded.name,
           description              = excluded.description,
           emoji                    = excluded.emoji,
           body                     = excluded.body,
           file_path                = excluded.file_path,
           source                   = excluded.source,
           pkg_name                 = excluded.pkg_name,
           homepage                 = excluded.homepage,
           enabled                  = excluded.enabled,
           user_invocable           = excluded.user_invocable,
           disable_model_invocation = excluded.disable_model_invocation,
           updated                  = excluded.updated",
    )
    .bind(&skill.id)
    .bind(&skill.name)
    .bind(&skill.description)
    .bind(
        skill
            .metadata
            .as_ref()
            .and_then(|m| m.get("emoji"))
            .and_then(|v| v.as_str())
            .unwrap_or(""),
    )
    .bind(&skill.body)
    .bind(
        skill
            .metadata
            .as_ref()
            .and_then(|m| m.get("file_path"))
            .and_then(|v| v.as_str())
            .unwrap_or(""),
    )
    .bind(&source)
    .bind(
        skill
            .metadata
            .as_ref()
            .and_then(|m| m.get("pkg_name"))
            .and_then(|v| v.as_str()),
    )
    .bind(skill.homepage.as_deref())
    .bind(skill.enabled as i64)
    .bind(skill.user_invocable as i64)
    .bind(skill.disable_model_invocation as i64)
    .bind(skill.created)
    .bind(skill.updated)
    .execute(&p)
    .await;
}

pub async fn delete(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM skill_pkg WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

pub async fn load_all(app: &AppHandle) -> Vec<Skill> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, name, description, emoji, body, file_path, source, pkg_name,
                homepage, enabled, user_invocable, disable_model_invocation,
                created, updated
         FROM skill_pkg ORDER BY updated DESC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|r| {
            let source_str: String = r.get("source");
            let source = match source_str.as_str() {
                "bundled" => SkillSource::Bundled,
                "npx" => SkillSource::Managed,
                _ => SkillSource::Workspace,
            };
            let emoji: String = r.get("emoji");
            let file_path: String = r.get("file_path");
            let pkg_name: Option<String> = r.get("pkg_name");
            let mut meta = serde_json::json!({});
            if !emoji.is_empty() {
                meta["emoji"] = serde_json::Value::String(emoji);
            }
            if !file_path.is_empty() {
                meta["file_path"] = serde_json::Value::String(file_path);
            }
            if let Some(p) = pkg_name {
                meta["pkg_name"] = serde_json::Value::String(p);
            }
            let metadata = if meta.as_object().map(|m| m.is_empty()).unwrap_or(true) {
                None
            } else {
                Some(meta)
            };
            Skill {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                body: r.get("body"),
                source,
                enabled: r.get::<i64, _>("enabled") != 0,
                user_invocable: r.get::<i64, _>("user_invocable") != 0,
                disable_model_invocation: r.get::<i64, _>("disable_model_invocation") != 0,
                homepage: r.get("homepage"),
                metadata,
                created: r.get("created"),
                updated: r.get("updated"),
            }
        })
        .collect()
}
