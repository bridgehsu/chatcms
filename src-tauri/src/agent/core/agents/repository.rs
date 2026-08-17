use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::AgentProfile;
use crate::config::AppConfig;
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

pub async fn load_all(app: &AppHandle) -> Vec<AgentProfile> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, slug, name, remark, system_prompt, enabled,
                skills, spawnable, perms, workspace_dir, sort, created, updated
         FROM agent WHERE yn = 0 ORDER BY sort ASC, enabled DESC, updated DESC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|r| {
            let skills_str: Option<String> = r.get("skills");
            let skills: Option<Vec<String>> = skills_str
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());

            let perms_str: String = r.get("perms");
            let perms = serde_json::from_str(&perms_str).unwrap_or_default();

            AgentProfile {
                id: r.get("id"),
                slug: r.get("slug"),
                name: r.get("name"),
                remark: r.get("remark"),
                system_prompt: r.get("system_prompt"),
                enabled: r.get::<i64, _>("enabled") != 0,
                skills,
                spawnable: r.get::<i64, _>("spawnable") != 0,
                perms,
                workspace_dir: r.get("workspace_dir"),
                sort: r.get("sort"),
                created: r.get("created"),
                updated: r.get("updated"),
            }
        })
        .collect()
}

pub async fn save(app: &AppHandle, agent: &AgentProfile) {
    let p = pool(app);
    let skills = serde_json::to_string(&agent.skills).unwrap_or_else(|_| "null".into());
    let perms = serde_json::to_string(&agent.perms).unwrap_or_else(|_| "{}".into());
    let _ = sqlx::query(
        "INSERT INTO agent
         (id, slug, name, remark, system_prompt, enabled,
          skills, spawnable, perms, workspace_dir, sort, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           slug          = excluded.slug,
           name          = excluded.name,
           remark        = excluded.remark,
           system_prompt = excluded.system_prompt,
           enabled       = excluded.enabled,
           skills        = excluded.skills,
           spawnable     = excluded.spawnable,
           perms         = excluded.perms,
           workspace_dir = excluded.workspace_dir,
           sort          = excluded.sort,
           updated       = excluded.updated",
    )
    .bind(&agent.id)
    .bind(&agent.slug)
    .bind(&agent.name)
    .bind(&agent.remark)
    .bind(&agent.system_prompt)
    .bind(agent.enabled as i64)
    .bind(&skills)
    .bind(agent.spawnable as i64)
    .bind(&perms)
    .bind(&agent.workspace_dir)
    .bind(agent.sort)
    .bind(agent.created)
    .bind(agent.updated)
    .execute(&p)
    .await;
}

pub async fn delete(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM agent WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

pub fn load_config(app: &AppHandle) -> Option<AppConfig> {
    crate::persist::load_config(app)
}

pub fn save_config(app: &AppHandle, config: &AppConfig) {
    crate::persist::save_config(app, config);
}
