use super::{
    AuditEvent, DomainInfo, DomainPolicy, PermissionConfig, PermissionMode, RememberScope,
};
use crate::agent::AgentState;
use crate::persist;
use std::collections::HashMap;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn permission_respond(
    state: State<'_, AgentState>,
    request_id: String,
    allowed: bool,
    remember: Option<String>,
) {
    let remember = match remember.as_deref() {
        Some("session_allow") => RememberScope::SessionAllow,
        Some("session_deny") => RememberScope::SessionDeny,
        _ => RememberScope::Once,
    };
    super::resolve_permission(&state, &request_id, allowed, remember);
}

#[tauri::command]
pub fn permission_get(state: State<'_, AgentState>) -> PermissionConfig {
    let mut cfg = state.config.lock().unwrap().permission.clone();
    cfg.ensure_defaults();
    cfg
}

#[tauri::command]
pub fn permission_set(
    app: AppHandle,
    state: State<'_, AgentState>,
    config: PermissionConfig,
) -> Result<(), String> {
    let mut cfg = config;
    cfg.ensure_defaults();
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission = cfg;
    persist::save_config(&app, &app_cfg);
    Ok(())
}

#[tauri::command]
pub fn permission_mode_list(state: State<'_, AgentState>) -> Vec<PermissionMode> {
    let mut cfg = state.config.lock().unwrap().permission.clone();
    cfg.ensure_defaults();
    super::list_modes(&cfg)
}

#[tauri::command]
pub fn permission_mode_add(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
    description: String,
    domains: Option<HashMap<String, DomainPolicy>>,
) -> Result<PermissionMode, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    let mode = super::add_mode(&mut app_cfg.permission, name, description, domains)?;
    persist::save_config(&app, &app_cfg);
    Ok(mode)
}

#[tauri::command]
pub fn permission_mode_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
    name: String,
    description: String,
    domains: HashMap<String, DomainPolicy>,
) -> Result<PermissionMode, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    let mode = super::update_mode(&mut app_cfg.permission, &id, name, description, domains)?;
    persist::save_config(&app, &app_cfg);
    Ok(mode)
}

#[tauri::command]
pub fn permission_mode_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    super::remove_mode(&mut app_cfg.permission, &id)?;
    persist::save_config(&app, &app_cfg);
    Ok(())
}

#[tauri::command]
pub fn permission_mode_reorder(
    app: AppHandle,
    state: State<'_, AgentState>,
    ordered_ids: Vec<String>,
) -> Result<Vec<PermissionMode>, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    super::reorder_modes(&mut app_cfg.permission, ordered_ids)?;
    let list = super::list_modes(&app_cfg.permission);
    persist::save_config(&app, &app_cfg);
    Ok(list)
}

#[tauri::command]
pub fn permission_mode_set_active(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<PermissionMode, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    let mode = super::set_active_mode(&mut app_cfg.permission, &id)?;
    persist::save_config(&app, &app_cfg);
    Ok(mode)
}

#[tauri::command]
pub fn permission_domains(state: State<'_, AgentState>) -> Vec<DomainInfo> {
    let mut cfg = state.config.lock().unwrap().permission.clone();
    cfg.ensure_defaults();
    super::Domain::all()
        .iter()
        .map(|d| DomainInfo {
            id: d.as_str().to_string(),
            label: d.label().to_string(),
            policy: cfg.domain_policy(*d),
        })
        .collect()
}

#[tauri::command]
pub async fn permission_audit_list(app: AppHandle, limit: Option<usize>) -> Vec<AuditEvent> {
    super::list_audit(&app, limit.unwrap_or(100)).await
}

#[tauri::command]
pub fn permission_clear_session_grants(state: State<'_, AgentState>, session_id: String) {
    state
        .session_grants
        .lock()
        .unwrap()
        .clear_session(&session_id);
}
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("permission")
        .invoke_handler(tauri::generate_handler![
            permission_respond,
            permission_get,
            permission_set,
            permission_mode_list,
            permission_mode_add,
            permission_mode_update,
            permission_mode_remove,
            permission_mode_reorder,
            permission_mode_set_active,
            permission_domains,
            permission_audit_list,
            permission_clear_session_grants,
        ])
        .build()
}
