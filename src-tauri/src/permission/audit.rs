use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::types::{AuditDecision, Domain, RunMode};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub ts: u64,
    pub session_id: String,
    pub agent_id: Option<String>,
    pub domain: String,
    pub tool_name: String,
    pub input_summary: String,
    pub decision: AuditDecision,
    #[serde(default)]
    pub run_mode: RunMode,
    #[serde(default)]
    pub mode_name: String,
    #[serde(default)]
    pub grant_used: bool,
}

const AUDIT_CAP: usize = 500;

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn append_audit(app: &AppHandle, event: AuditEvent) {
    let mut list = crate::persist::load_permission_audit(app);
    list.insert(0, event);
    if list.len() > AUDIT_CAP {
        list.truncate(AUDIT_CAP);
    }
    crate::persist::save_permission_audit(app, &list);
}

pub fn list_audit(app: &AppHandle, limit: usize) -> Vec<AuditEvent> {
    let list = crate::persist::load_permission_audit(app);
    list.into_iter().take(limit.max(1)).collect()
}

pub fn make_audit(
    session_id: &str,
    agent_id: Option<&str>,
    domain: Domain,
    tool_name: &str,
    input_summary: &str,
    decision: AuditDecision,
    mode_name: &str,
    grant_used: bool,
) -> AuditEvent {
    AuditEvent {
        id: uuid::Uuid::new_v4().to_string(),
        ts: now_secs(),
        session_id: session_id.to_string(),
        agent_id: agent_id.map(str::to_string),
        domain: domain.as_str().to_string(),
        tool_name: tool_name.to_string(),
        input_summary: input_summary.to_string(),
        decision,
        run_mode: RunMode::Assist,
        mode_name: mode_name.to_string(),
        grant_used,
    }
}
