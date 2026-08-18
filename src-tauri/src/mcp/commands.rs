use super::{McpServerConfig, McpServerInfo, McpToolDef};
use crate::agents::AgentState;
use std::collections::HashMap;
use tauri::{AppHandle, State};

use super::service;

#[tauri::command]
pub async fn mcp_list(state: State<'_, AgentState>) -> Result<Vec<McpServerInfo>, String> {
    Ok(service::list(&state).await)
}

#[tauri::command]
pub async fn mcp_add(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: Option<String>,
    description: String,
    enabled: bool,
) -> Result<McpServerInfo, String> {
    let config = McpServerConfig {
        command,
        args,
        env,
        cwd: cwd.filter(|s| !s.trim().is_empty()),
        description,
        enabled,
    };
    service::add(&app, &state, name, config).await
}

#[tauri::command]
pub async fn mcp_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: Option<String>,
    description: String,
    enabled: bool,
) -> Result<McpServerInfo, String> {
    let config = McpServerConfig {
        command,
        args,
        env,
        cwd: cwd.filter(|s| !s.trim().is_empty()),
        description,
        enabled,
    };
    service::update(&app, &state, name, config).await
}

#[tauri::command]
pub async fn mcp_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
) -> Result<(), String> {
    service::remove(&app, &state, name).await;
    Ok(())
}

#[tauri::command]
pub async fn mcp_reconnect(
    state: State<'_, AgentState>,
    name: String,
) -> Result<McpServerInfo, String> {
    service::reconnect(&state, name).await
}

#[tauri::command]
pub async fn mcp_disconnect(
    state: State<'_, AgentState>,
    name: String,
) -> Result<McpServerInfo, String> {
    service::disconnect(&state, name).await
}

#[tauri::command]
pub async fn mcp_tools(
    state: State<'_, AgentState>,
    name: String,
) -> Result<Vec<McpToolDef>, String> {
    Ok(service::tools(&state, name).await)
}

#[allow(dead_code)]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("mcp")
        .invoke_handler(tauri::generate_handler![
            mcp_list,
            mcp_add,
            mcp_update,
            mcp_remove,
            mcp_reconnect,
            mcp_disconnect,
            mcp_tools,
        ])
        .build()
}
