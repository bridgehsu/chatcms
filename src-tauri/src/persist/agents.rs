use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::agents::AgentProfile;
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

/// 保存单条代理（upsert）。
pub async fn save_agent(app: &AppHandle, agent: &AgentProfile) {
    let p = pool(app);
    let skills = serde_json::to_string(&agent.skills).unwrap_or_else(|_| "null".into());
    let overrides = serde_json::to_string(&agent.permission_overrides).unwrap_or_else(|_| "{}".into());
    let _ = sqlx::query(
        "INSERT INTO agent
         (id, code, slug, name, description, system_prompt, emoji, enabled, is_default,
          skills, allow_as_subagent, permission_overrides, workspace_dir, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           code                 = excluded.code,
           slug                 = excluded.slug,
           name                 = excluded.name,
           description          = excluded.description,
           system_prompt        = excluded.system_prompt,
           emoji                = excluded.emoji,
           enabled              = excluded.enabled,
           is_default           = excluded.is_default,
           skills               = excluded.skills,
           allow_as_subagent    = excluded.allow_as_subagent,
           permission_overrides = excluded.permission_overrides,
           workspace_dir        = excluded.workspace_dir,
           updated              = excluded.updated",
    )
    .bind(&agent.id)
    .bind(&agent.code)
    .bind(&agent.slug)
    .bind(&agent.name)
    .bind(&agent.description)
    .bind(&agent.system_prompt)
    .bind(&agent.emoji)
    .bind(agent.enabled as i64)
    .bind(agent.is_default as i64)
    .bind(&skills)
    .bind(agent.allow_as_subagent as i64)
    .bind(&overrides)
    .bind(&agent.workspace_dir)
    .bind(agent.created)
    .bind(agent.updated)
    .execute(&p)
    .await;
}

/// 删除单条代理。
pub async fn delete_agent(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM agent WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

/// 加载所有代理。
pub async fn load_all_agents(app: &AppHandle) -> Vec<AgentProfile> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, code, slug, name, description, system_prompt, emoji, enabled, is_default,
                skills, allow_as_subagent, permission_overrides, workspace_dir, created, updated
         FROM agent WHERE yn = 0 ORDER BY is_default DESC, enabled DESC, updated DESC",
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

            let overrides_str: String = r.get("permission_overrides");
            let permission_overrides = serde_json::from_str(&overrides_str).unwrap_or_default();

            AgentProfile {
                id: r.get("id"),
                code: r.get("code"),
                slug: r.get("slug"),
                name: r.get("name"),
                description: r.get("description"),
                system_prompt: r.get("system_prompt"),
                emoji: r.get("emoji"),
                enabled: r.get::<i64, _>("enabled") != 0,
                is_default: r.get::<i64, _>("is_default") != 0,
                skills,
                allow_as_subagent: r.get::<i64, _>("allow_as_subagent") != 0,
                permission_overrides,
                workspace_dir: r.get("workspace_dir"),
                created: r.get("created"),
                updated: r.get("updated"),
            }
        })
        .collect()
}
