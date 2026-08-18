use std::collections::HashMap;

use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::{Message, Role, Session};
use crate::db::DbPool;

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

/// 启动时加载所有会话（含 messages）。
pub async fn load_all(app: &AppHandle) -> HashMap<String, Session> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, title, pinned, agent_id, workspace_dir, profile_id, created, updated FROM sessions",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    let mut map = HashMap::new();
    for row in rows {
        let id: String = row.get("id");
        let msg_rows = sqlx::query(
            "SELECT id, role, content, created FROM messages
             WHERE session_id = ? ORDER BY created ASC",
        )
        .bind(&id)
        .fetch_all(&p)
        .await
        .unwrap_or_default();

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
                    created: r.get::<i64, _>("created") as u64,
                }
            })
            .collect();

        let pinned: i64 = row.get("pinned");
        let created: i64 = row.get("created");
        let updated: i64 = row.get("updated");
        map.insert(
            id.clone(),
            Session {
                id,
                title: row.get("title"),
                messages,
                pinned: pinned != 0,
                agent_id: row.get("agent_id"),
                workspace_dir: row.get("workspace_dir"),
                profile_id: row.get("profile_id"),
                created: created as u64,
                updated: updated as u64,
            },
        );
    }
    map
}

/// 持久化单个会话（upsert session + 重写 messages）。
pub async fn save(app: &AppHandle, session: &Session) {
    let p = pool(app);
    let _ = sqlx::query(
        "INSERT INTO sessions (id, title, pinned, agent_id, workspace_dir, profile_id, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title         = excluded.title,
           pinned        = excluded.pinned,
           agent_id      = excluded.agent_id,
           workspace_dir = excluded.workspace_dir,
           profile_id    = excluded.profile_id,
           updated       = excluded.updated",
    )
    .bind(&session.id)
    .bind(&session.title)
    .bind(session.pinned as i64)
    .bind(&session.agent_id)
    .bind(&session.workspace_dir)
    .bind(&session.profile_id)
    .bind(session.created as i64)
    .bind(session.updated as i64)
    .execute(&p)
    .await;

    let _ = sqlx::query("DELETE FROM messages WHERE session_id = ?")
        .bind(&session.id)
        .execute(&p)
        .await;

    for msg in &session.messages {
        let role_str = match msg.role {
            Role::User => "user",
            Role::Assistant => "assistant",
            Role::System => "system",
            Role::Tool => "tool",
        };
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO messages (id, session_id, role, content, created)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&msg.id)
        .bind(&session.id)
        .bind(role_str)
        .bind(&msg.content)
        .bind(msg.created as i64)
        .execute(&p)
        .await;
    }
}

/// 删除会话（级联删除 messages）。
pub async fn delete(app: &AppHandle, id: &str) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM sessions WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await;
}
