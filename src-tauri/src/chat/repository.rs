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
        "SELECT id, title, pinned, agent_id, workspace_dir, profile_id, group_id, created, updated FROM sessions",
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
                group_id: row.get("group_id"),
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
        "INSERT INTO sessions (id, title, pinned, agent_id, workspace_dir, profile_id, group_id, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title         = excluded.title,
           pinned        = excluded.pinned,
           agent_id      = excluded.agent_id,
           workspace_dir = excluded.workspace_dir,
           profile_id    = excluded.profile_id,
           group_id      = excluded.group_id,
           updated       = excluded.updated",
    )
    .bind(&session.id)
    .bind(&session.title)
    .bind(session.pinned as i64)
    .bind(&session.agent_id)
    .bind(&session.workspace_dir)
    .bind(&session.profile_id)
    .bind(&session.group_id)
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

// ── session_group ─────────────────────────────────────────────────────────────

pub async fn list_groups(app: &AppHandle) -> Vec<super::SessionGroup> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, name, sort_order, created, updated FROM session_group
         ORDER BY sort_order ASC, created ASC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|r| super::SessionGroup {
            id: r.get("id"),
            name: r.get("name"),
            sort_order: r.get("sort_order"),
            created: r.get::<i64, _>("created") as u64,
            updated: r.get::<i64, _>("updated") as u64,
        })
        .collect()
}

pub async fn insert_group(app: &AppHandle, g: &super::SessionGroup) -> Result<(), String> {
    let p = pool(app);
    sqlx::query(
        "INSERT INTO session_group (id, name, sort_order, created, updated)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&g.id)
    .bind(&g.name)
    .bind(g.sort_order)
    .bind(g.created as i64)
    .bind(g.updated as i64)
    .execute(&p)
    .await
    .map_err(|e| format!("创建分组失败：{e}"))?;
    Ok(())
}

pub async fn update_group(app: &AppHandle, g: &super::SessionGroup) -> Result<(), String> {
    let p = pool(app);
    let n = sqlx::query(
        "UPDATE session_group SET name = ?, sort_order = ?, updated = ? WHERE id = ?",
    )
    .bind(&g.name)
    .bind(g.sort_order)
    .bind(g.updated as i64)
    .bind(&g.id)
    .execute(&p)
    .await
    .map_err(|e| format!("更新分组失败：{e}"))?
    .rows_affected();
    if n == 0 {
        return Err("分组不存在".into());
    }
    Ok(())
}

pub async fn delete_group(app: &AppHandle, id: &str) -> Result<(), String> {
    let p = pool(app);
    let n = sqlx::query("DELETE FROM session_group WHERE id = ?")
        .bind(id)
        .execute(&p)
        .await
        .map_err(|e| format!("删除分组失败：{e}"))?
        .rows_affected();
    if n == 0 {
        return Err("分组不存在".into());
    }
    Ok(())
}

pub async fn get_group(app: &AppHandle, id: &str) -> Option<super::SessionGroup> {
    let p = pool(app);
    let row = sqlx::query(
        "SELECT id, name, sort_order, created, updated FROM session_group WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&p)
    .await
    .ok()
    .flatten()?;
    Some(super::SessionGroup {
        id: row.get("id"),
        name: row.get("name"),
        sort_order: row.get("sort_order"),
        created: row.get::<i64, _>("created") as u64,
        updated: row.get::<i64, _>("updated") as u64,
    })
}

pub async fn next_group_sort_order(app: &AppHandle) -> i64 {
    let p = pool(app);
    sqlx::query_scalar::<_, i64>("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM session_group")
        .fetch_one(&p)
        .await
        .unwrap_or(1)
}

/// 保存一次会话链路观测记录。
pub async fn save_turn_trace(app: &AppHandle, trace: &super::trace::ChatTurnTrace) {
    let p = pool(app);
    let phases = serde_json::to_string(&trace.phases).unwrap_or_else(|_| "[]".into());
    if let Err(e) = sqlx::query(
        "INSERT OR REPLACE INTO chat_turn_trace
         (id, session_id, ts, content_len, intent_kind, needs_tools, chat_mode, model, base_url,
          thinking, tools_count, msg_count, system_chars, http_ms, ttft_ms, stream_ms,
          total_ms, ok, error, input_tokens, output_tokens, tool_rounds, phases_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&trace.id)
    .bind(&trace.session_id)
    .bind(trace.ts)
    .bind(trace.content_len as i64)
    .bind(&trace.intent_kind)
    .bind(trace.needs_tools as i64)
    .bind(&trace.chat_mode)
    .bind(&trace.model)
    .bind(&trace.base_url)
    .bind(trace.thinking as i64)
    .bind(trace.tools_count as i64)
    .bind(trace.msg_count as i64)
    .bind(trace.system_chars as i64)
    .bind(trace.http_ms.map(|v| v as i64))
    .bind(trace.ttft_ms.map(|v| v as i64))
    .bind(trace.stream_ms.map(|v| v as i64))
    .bind(trace.total_ms as i64)
    .bind(trace.ok as i64)
    .bind(&trace.error)
    .bind(trace.input_tokens as i64)
    .bind(trace.output_tokens as i64)
    .bind(trace.tool_rounds as i64)
    .bind(&phases)
    .execute(&p)
    .await
    {
        log::error!(
            target: "chatcms_lib::chat.trace",
            "save_turn_trace failed id={} session={}: {e:#}",
            trace.id,
            trace.session_id,
        );
    }
}

/// 最近 N 条会话链路观测。
pub async fn list_turn_traces(app: &AppHandle, limit: i64) -> Vec<super::trace::ChatTurnTrace> {
    let p = pool(app);
    let rows = match sqlx::query(
        "SELECT id, session_id, ts, content_len, intent_kind, needs_tools, chat_mode, model, base_url,
                thinking, tools_count, msg_count, system_chars, http_ms, ttft_ms, stream_ms,
                total_ms, ok, error, input_tokens, output_tokens, tool_rounds, phases_json
         FROM chat_turn_trace ORDER BY ts DESC LIMIT ?",
    )
    .bind(limit.max(1))
    .fetch_all(&p)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            log::error!(
                target: "chatcms_lib::chat.trace",
                "list_turn_traces failed: {e:#}",
            );
            return Vec::new();
        }
    };

    rows.into_iter()
        .map(|r| {
            let phases_json: String = r.get("phases_json");
            let phases: Vec<super::trace::TracePhase> =
                serde_json::from_str(&phases_json).unwrap_or_default();
            super::trace::ChatTurnTrace {
                id: r.get("id"),
                session_id: r.get("session_id"),
                ts: r.get("ts"),
                content_len: r.get::<i64, _>("content_len") as usize,
                intent_kind: r.get("intent_kind"),
                needs_tools: r.get::<i64, _>("needs_tools") != 0,
                chat_mode: r.try_get::<String, _>("chat_mode").unwrap_or_default(),
                model: r.get("model"),
                base_url: r.get("base_url"),
                thinking: r.get::<i64, _>("thinking") != 0,
                tools_count: r.get::<i64, _>("tools_count") as usize,
                msg_count: r.get::<i64, _>("msg_count") as usize,
                system_chars: r.get::<i64, _>("system_chars") as usize,
                http_ms: r.get::<Option<i64>, _>("http_ms").map(|v| v as u64),
                ttft_ms: r.get::<Option<i64>, _>("ttft_ms").map(|v| v as u64),
                stream_ms: r.get::<Option<i64>, _>("stream_ms").map(|v| v as u64),
                total_ms: r.get::<i64, _>("total_ms") as u64,
                ok: r.get::<i64, _>("ok") != 0,
                error: r.get("error"),
                input_tokens: r.get::<i64, _>("input_tokens") as u32,
                output_tokens: r.get::<i64, _>("output_tokens") as u32,
                tool_rounds: r.get::<i64, _>("tool_rounds") as usize,
                phases,
            }
        })
        .collect()
}
