use super::AgentProfile;
use crate::agents::AgentState;
use crate::permission::DomainPolicy;
use std::collections::HashMap;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn agent_list(app: AppHandle, state: State<'_, AgentState>) -> Result<Vec<AgentProfile>, String> {
    let list = super::service::list(&app).await;
    *state.agents.lock().unwrap() = list.clone();
    Ok(list)
}

#[tauri::command]
pub async fn agent_add(
    app: AppHandle,
    state: State<'_, AgentState>,
    slug: String,
    name: String,
    remark: String,
    system_prompt: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    spawnable: bool,
    perms: Option<HashMap<String, DomainPolicy>>,
    sort: Option<i64>,
) -> Result<AgentProfile, String> {
    let profile = super::service::add(
        &app,
        slug,
        name,
        remark,
        system_prompt,
        enabled,
        skills,
        spawnable,
        perms.unwrap_or_default(),
        sort.unwrap_or(0),
    )
    .await?;
    *state.agents.lock().unwrap() = super::service::list(&app).await;
    Ok(profile)
}

#[tauri::command]
pub async fn agent_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
    slug: String,
    name: String,
    remark: String,
    system_prompt: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    spawnable: bool,
    perms: Option<HashMap<String, DomainPolicy>>,
    sort: Option<i64>,
) -> Result<AgentProfile, String> {
    let profile = super::service::update(
        &app,
        id,
        slug,
        name,
        remark,
        system_prompt,
        enabled,
        skills,
        spawnable,
        perms.unwrap_or_default(),
        sort.unwrap_or(0),
    )
    .await?;
    *state.agents.lock().unwrap() = super::service::list(&app).await;
    Ok(profile)
}

#[tauri::command]
pub async fn agent_activate(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<AgentProfile, String> {
    let profile = super::service::activate(&app, id.clone()).await?;
    state.config.lock().unwrap().active_agent_id = Some(id);
    *state.agents.lock().unwrap() = super::service::list(&app).await;
    Ok(profile)
}

#[tauri::command]
pub async fn agent_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    super::service::remove(&app, id.clone()).await?;
    // 如果删除的是当前激活代理，清除 state 中的 active_agent_id
    {
        let mut config = state.config.lock().unwrap();
        if config.active_agent_id.as_deref() == Some(&id) {
            config.active_agent_id = None;
        }
    }
    *state.agents.lock().unwrap() = super::service::list(&app).await;
    Ok(())
}

#[allow(dead_code)]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("agents")
        .invoke_handler(tauri::generate_handler![
            agent_list,
            agent_add,
            agent_update,
            agent_activate,
            agent_remove,
        ])
        .build()
}
