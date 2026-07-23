//! 危险工具权限：前端弹窗确认，超时默认拒绝。

use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;

use crate::tools;

use super::state::AgentState;

/// 发给前端的权限请求载荷（对应事件 `permission-request`）。
#[derive(serde::Serialize, Clone)]
pub struct PermissionRequest {
    /// 本次请求 ID，前端回调用
    pub request_id: String,
    pub session_id: String,
    pub tool_name: String,
    pub input: Value,
}

/// 向 UI 请求批准危险工具；60 秒无响应视为拒绝。
pub async fn request_permission(
    app: &AppHandle,
    state: &State<'_, AgentState>,
    session_id: &str,
    tc: &tools::ToolCall,
) -> bool {
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel::<bool>();
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
            input: tc.input.clone(),
        },
    );

    match tokio::time::timeout(std::time::Duration::from_secs(60), rx).await {
        Ok(Ok(allowed)) => allowed,
        _ => false, // 超时或通道关闭 → 拒绝
    }
}

/// 前端调用 `permission_respond` 后，唤醒对应的 oneshot。
pub fn resolve_permission(state: &State<'_, AgentState>, request_id: &str, allowed: bool) {
    let mut pending = state.pending_permissions.lock().unwrap();
    if let Some(tx) = pending.remove(request_id) {
        let _ = tx.send(allowed);
    }
}
