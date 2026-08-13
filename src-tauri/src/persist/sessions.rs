use std::collections::HashMap;

use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::db::DbPool;
use crate::memory::{Message, Role, Session};

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

/// 持久化单个会话（upsert session + 重写 messages）。
pub async fn save_session(app: &AppHandle, session: &Session) {
    let p = pool(app);
    let _ = upsert_session(&p, session).await;
}

async fn upsert_session(pool: &sqlx::SqlitePool, session: &Session) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO sessions (id, title, pinned, agent_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title      = excluded.title,
           pinned     = excluded.pinned,
           agent_id   = excluded.agent_id,
           updated_at = excluded.updated_at",
    )
    .bind(&session.id)
    .bind(&session.title)
    .bind(session.pinned as i64)
    .bind(&session.agent_id)
    .bind(session.created_at as i64)
    .bind(session.updated_at as i64)
    .execute(pool)
    .await?;

    // 全量替换消息（保证顺序和内容一致）
    sqlx::query("DELETE FROM messages WHERE session_id = ?")
        .bind(&session.id)
        .execute(pool)
        .await?;

    for msg in &session.messages {
        let role_str = match msg.role {
            Role::User => "user",
            Role::Assistant => "assistant",
            Role::System => "system",
            Role::Tool => "tool",
        };
        sqlx::query(
            "INSERT OR IGNORE INTO messages (id, session_id, role, content, created_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&msg.id)
        .bind(&session.id)
        .bind(role_str)
        .bind(&msg.content)
        .bind(msg.created_at as i64)
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// 删除会话（级联删除 messages）。
pub async fn delete_session(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM sessions WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}

/// 启动时加载所有会话（含 messages）。
pub async fn load_all_sessions(app: &AppHandle) -> HashMap<String, Session> {
    let p = pool(app);
    load_from_pool(&p).await.unwrap_or_default()
}

async fn load_from_pool(pool: &sqlx::SqlitePool) -> anyhow::Result<HashMap<String, Session>> {
    let rows =
        sqlx::query("SELECT id, title, pinned, agent_id, created_at, updated_at FROM sessions")
            .fetch_all(pool)
            .await?;

    let mut map = HashMap::new();
    for row in rows {
        let id: String = row.get("id");
        let title: String = row.get("title");
        let pinned: i64 = row.get("pinned");
        let agent_id: Option<String> = row.get("agent_id");
        let created_at: i64 = row.get("created_at");
        let updated_at: i64 = row.get("updated_at");

        let msg_rows = sqlx::query(
            "SELECT id, role, content, created_at FROM messages
             WHERE session_id = ? ORDER BY created_at ASC",
        )
        .bind(&id)
        .fetch_all(pool)
        .await?;

        let messages: Vec<Message> = msg_rows
            .into_iter()
            .map(|r| {
                let role_str: String = r.get("role");
                let role = match role_str.as_str() {
                    "user" => Role::User,
                    "assistant" => Role::Assistant,
                    "system" => Role::System,
                    _ => Role::Tool,
                };
                Message {
                    id: r.get("id"),
                    role,
                    content: r.get("content"),
                    created_at: r.get::<i64, _>("created_at") as u64,
                }
            })
            .collect();

        map.insert(
            id.clone(),
            Session {
                id,
                title,
                messages,
                pinned: pinned != 0,
                agent_id,
                created_at: created_at as u64,
                updated_at: updated_at as u64,
            },
        );
    }

    Ok(map)
}
