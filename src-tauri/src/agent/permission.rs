//! 危险工具权限：前端弹窗确认，超时默认拒绝；支持会话级记住。

use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;

use crate::permission::{Domain, RememberScope};
use crate::tools;
use crate::agent::state::PermissionUserReply;

use super::state::AgentState;

/// 发给前端的权限请求载荷（对应事件 `permission-request`）。
#[derive(serde::Serialize, Clone)]
pub struct PermissionRequest {
    pub request_id: String,
    pub session_id: String,
    pub tool_name: String,
    pub domain: String,
    pub domain_label: String,
    pub input: Value,
    pub input_summary: String,
}

/// 向 UI 请求批准；60 秒无响应视为拒绝。
pub async fn request_permission(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    session_id: &str,
    tc: &tools::ToolCall,
    domain: Domain,
    input_summary: &str,
) -> PermissionUserReply {
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel::<PermissionUserReply>();
    {
        let mut pending = state.pending_permissions.lock().unwrap();
        pending.insert(request_id.clone(), tx);
    }

    let _ = app.emit(
        "permission-request",
        PermissionRequest {
            request_id,
            session_id: session_id.to_string(),
            tool_name: tc.name.clone(),
            domain: domain.as_str().to_string(),
            domain_label: domain.label().to_string(),
            input: tc.input.clone(),
            input_summary: input_summary.to_string(),
        },
    );

    match tokio::time::timeout(std::time::Duration::from_secs(60), rx).await {
        Ok(Ok(reply)) => reply,
        _ => PermissionUserReply {
            allowed: false,
            remember: RememberScope::Once,
        },
    }
}

/// 前端调用 `permission_respond` 后，唤醒对应的 oneshot。
pub fn resolve_permission(
    state: &State<'_, AgentState>,
    request_id: &str,
    allowed: bool,
    remember: RememberScope,
) {
    let mut pending = state.pending_permissions.lock().unwrap();
    if let Some(tx) = pending.remove(request_id) {
        let _ = tx.send(PermissionUserReply { allowed, remember });
    }
}
