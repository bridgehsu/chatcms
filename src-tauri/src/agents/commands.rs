use super::AgentProfile;
use crate::agent::AgentState;
use crate::permission::DomainPolicy;
use std::collections::HashMap;
use tauri::{AppHandle, State};

fn sync_state(app: &AppHandle, state: &State<'_, AgentState>) {
    *state.agents.lock().unwrap() = super::list(app);
}

#[tauri::command]
pub fn agent_list(app: AppHandle, state: State<'_, AgentState>) -> Vec<AgentProfile> {
    let list = super::list(&app);
    *state.agents.lock().unwrap() = list.clone();
    list
}

#[tauri::command]
pub fn agent_add(
    app: AppHandle,
    state: State<'_, AgentState>,
    slug: String,
    name: String,
    description: String,
    system_prompt: String,
    emoji: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    allow_as_subagent: bool,
    permission_overrides: Option<HashMap<String, DomainPolicy>>,
) -> Result<AgentProfile, String> {
    let profile = super::add(
        &app,
        slug,
        name,
        description,
        system_prompt,
        emoji,
        enabled,
        skills,
        allow_as_subagent,
        permission_overrides.unwrap_or_default(),
    )?;
    sync_state(&app, &state);
    Ok(profile)
}

#[tauri::command]
pub fn agent_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
    slug: String,
    name: String,
    description: String,
    system_prompt: String,
    emoji: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    allow_as_subagent: bool,
    permission_overrides: Option<HashMap<String, DomainPolicy>>,
) -> Result<AgentProfile, String> {
    let profile = super::update(
        &app,
        id,
        slug,
        name,
        description,
        system_prompt,
        emoji,
        enabled,
        skills,
        allow_as_subagent,
        permission_overrides.unwrap_or_default(),
    )?;
    sync_state(&app, &state);
    Ok(profile)
}

#[tauri::command]
pub fn agent_activate(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<AgentProfile, String> {
    let profile = super::activate(&app, id)?;
    sync_state(&app, &state);
    Ok(profile)
}

#[tauri::command]
pub fn agent_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    super::remove(&app, id)?;
    sync_state(&app, &state);
    Ok(())
}
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
