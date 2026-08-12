use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::db::DbPool;
use crate::permission::{AuditDecision, AuditEvent, RunMode};

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

/// 追加一条审计记录（INSERT，不加载历史）。
pub async fn append_audit_event(app: &AppHandle, event: &AuditEvent) {
    let p = pool(app);
    let decision = serde_json::to_string(&event.decision)
        .unwrap_or_else(|_| "\"deny_policy\"".into())
        .trim_matches('"')
        .to_string();
    let run_mode = serde_json::to_string(&event.run_mode)
        .unwrap_or_else(|_| "\"assist\"".into())
        .trim_matches('"')
        .to_string();
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO audit_log
         (id, ts, session_id, agent_id, domain, tool_name, input_summary, decision, run_mode, mode_name, grant_used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&event.id)
    .bind(event.ts as i64)
    .bind(&event.session_id)
    .bind(&event.agent_id)
    .bind(&event.domain)
    .bind(&event.tool_name)
    .bind(&event.input_summary)
    .bind(&decision)
    .bind(&run_mode)
    .bind(&event.mode_name)
    .bind(event.grant_used as i64)
    .execute(&p)
    .await;
}

/// 查询审计记录（最近的 limit 条）。
pub async fn load_permission_audit(app: &AppHandle, limit: i64) -> Vec<AuditEvent> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, ts, session_id, agent_id, domain, tool_name, input_summary,
                decision, run_mode, mode_name, grant_used
         FROM audit_log ORDER BY ts DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|r| {
            let decision_str: String = r.get("decision");
            let run_mode_str: String = r.get("run_mode");
            let decision: AuditDecision =
                serde_json::from_str(&format!("\"{}\"", decision_str))
                    .unwrap_or(AuditDecision::DenyPolicy);
            let run_mode: RunMode =
                serde_json::from_str(&format!("\"{}\"", run_mode_str))
                    .unwrap_or(RunMode::Assist);
            AuditEvent {
                id: r.get("id"),
                ts: r.get::<i64, _>("ts") as u64,
                session_id: r.get("session_id"),
                agent_id: r.get("agent_id"),
                domain: r.get("domain"),
                tool_name: r.get("tool_name"),
                input_summary: r.get("input_summary"),
                decision,
                run_mode,
                mode_name: r.get("mode_name"),
                grant_used: r.get::<i64, _>("grant_used") != 0,
            }
        })
        .collect()
}
