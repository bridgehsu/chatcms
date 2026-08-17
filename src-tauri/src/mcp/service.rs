use std::collections::HashMap;
use tauri::AppHandle;

use super::{McpServerConfig, McpServerInfo, McpToolDef};
use crate::agent::AgentState;
use super::repository as repo;

pub async fn list(state: &AgentState) -> Vec<McpServerInfo> {
    state.mcp.lock().await.server_infos()
}

pub async fn add(
    app: &AppHandle,
    state: &AgentState,
    name: String,
    config: McpServerConfig,
) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.add_server(name.clone(), config).await?;
    repo::save_configs(app, &mcp.configs);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| "添加失败".into())
}

pub async fn update(
    app: &AppHandle,
    state: &AgentState,
    name: String,
    config: McpServerConfig,
) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.update_server(&name, config).await?;
    repo::save_configs(app, &mcp.configs);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| "更新失败".into())
}

pub async fn remove(app: &AppHandle, state: &AgentState, name: String) {
    let mut mcp = state.mcp.lock().await;
    mcp.remove_server(&name);
    repo::save_configs(app, &mcp.configs);
}

pub async fn reconnect(state: &AgentState, name: String) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.reconnect(&name).await;
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Server {name} not found"))
}

pub async fn disconnect(state: &AgentState, name: String) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.disconnect(&name);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Server {name} not found"))
}

pub async fn tools(state: &AgentState, name: String) -> Vec<McpToolDef> {
    state.mcp.lock().await.tools_for(&name)
}
