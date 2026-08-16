use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::db::DbPool;
use crate::kbase::{KnowledgeEntry, KnowledgeSiteProfile};

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

/// 新增或更新单条知识条目。
pub async fn save_knowledge_entry(app: &AppHandle, entry: &KnowledgeEntry) {
    let p = pool(app);
    let tags = serde_json::to_string(&entry.tags).unwrap_or_else(|_| "[]".into());
    let _ = sqlx::query(
        "INSERT INTO knowledge (id, title, description, content, tags, visibility, kind, slug, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title       = excluded.title,
           description = excluded.description,
           content     = excluded.content,
           tags        = excluded.tags,
           visibility  = excluded.visibility,
           kind        = excluded.kind,
           slug        = excluded.slug,
           updated     = excluded.updated",
    )
    .bind(&entry.id)
    .bind(&entry.title)
    .bind(&entry.description)
    .bind(&entry.content)
    .bind(&tags)
    .bind(&entry.visibility)
    .bind(&entry.kind)
    .bind(&entry.slug)
    .bind(entry.created as i64)
    .bind(entry.updated as i64)
    .execute(&p)
    .await;
}

/// 删除单条知识条目。
pub async fn delete_knowledge_entry(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM knowledge WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

/// 启动时加载所有知识条目。
pub async fn load_all_knowledge(app: &AppHandle) -> Vec<KnowledgeEntry> {
    let p = pool(app);
    load_knowledge_from_pool(&p).await.unwrap_or_default()
}

async fn load_knowledge_from_pool(pool: &sqlx::SqlitePool) -> anyhow::Result<Vec<KnowledgeEntry>> {
    let rows = sqlx::query(
        "SELECT id, title, description, content, tags, visibility, kind, slug, created, updated
         FROM knowledge ORDER BY updated DESC",
    )
    .fetch_all(pool)
    .await?;

    let entries = rows
        .into_iter()
        .map(|r| {
            let tags_str: String = r.get("tags");
            let tags: Vec<String> =
                serde_json::from_str(&tags_str).unwrap_or_default();
            KnowledgeEntry {
                id: r.get("id"),
                title: r.get("title"),
                description: r.get("description"),
                content: r.get("content"),
                tags,
                visibility: r.get("visibility"),
                kind: r.get("kind"),
                slug: r.get("slug"),
                created: r.get::<i64, _>("created") as u64,
                updated: r.get::<i64, _>("updated") as u64,
            }
        })
        .collect();

    Ok(entries)
}

/// 保存知识站点 profile。
pub async fn save_knowledge_site_profile(app: &AppHandle, profile: &KnowledgeSiteProfile) {
    let p = pool(app);
    let _ = sqlx::query(
        "INSERT INTO knowledge_site_profile (id, handle, display_name, bio)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           handle       = excluded.handle,
           display_name = excluded.display_name,
           bio          = excluded.bio",
    )
    .bind(&profile.handle)
    .bind(&profile.display_name)
    .bind(&profile.bio)
    .execute(&p)
    .await;
}

/// 加载知识站点 profile。
pub async fn load_knowledge_site_profile(app: &AppHandle) -> KnowledgeSiteProfile {
    let p = pool(app);
    sqlx::query("SELECT handle, display_name, bio FROM knowledge_site_profile WHERE id = 1")
        .fetch_optional(&p)
        .await
        .ok()
        .flatten()
        .map(|r| KnowledgeSiteProfile {
            handle: r.get("handle"),
            display_name: r.get("display_name"),
            bio: r.get("bio"),
        })
        .unwrap_or_default()
}
