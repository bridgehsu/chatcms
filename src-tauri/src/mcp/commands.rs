use super::{McpServerConfig, McpServerInfo, McpToolDef};
use crate::agent::AgentState;
use crate::persist;
use std::collections::HashMap;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn mcp_list(state: State<'_, AgentState>) -> Result<Vec<McpServerInfo>, String> {
    Ok(state.mcp.lock().await.server_infos())
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
    let mut mcp = state.mcp.lock().await;
    mcp.add_server(name.clone(), config).await?;
    persist::save_mcp_configs(&app, &mcp.configs);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| "添加失败".into())
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
    let mut mcp = state.mcp.lock().await;
    mcp.update_server(&name, config).await?;
    persist::save_mcp_configs(&app, &mcp.configs);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| "更新失败".into())
}

#[tauri::command]
pub async fn mcp_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
) -> Result<(), String> {
    let mut mcp = state.mcp.lock().await;
    mcp.remove_server(&name);
    persist::save_mcp_configs(&app, &mcp.configs);
    Ok(())
}

#[tauri::command]
pub async fn mcp_reconnect(
    state: State<'_, AgentState>,
    name: String,
) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.reconnect(&name).await;
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Server {name} not found"))
}

#[tauri::command]
pub async fn mcp_disconnect(
    state: State<'_, AgentState>,
    name: String,
) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.disconnect(&name);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Server {name} not found"))
}

#[tauri::command]
pub async fn mcp_tools(
    state: State<'_, AgentState>,
    name: String,
) -> Result<Vec<McpToolDef>, String> {
    Ok(state.mcp.lock().await.tools_for(&name))
}
