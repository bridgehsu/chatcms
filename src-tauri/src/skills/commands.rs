use super::Skill;
use crate::agent::AgentState;
use tauri::{AppHandle, State};

fn sync_state(app: &AppHandle, state: &State<'_, AgentState>) {
    *state.skills.lock().unwrap() = super::list(app);
}

#[tauri::command]
pub fn skill_list(app: AppHandle, state: State<'_, AgentState>) -> Vec<Skill> {
    let list = super::list(&app);
    *state.skills.lock().unwrap() = list.clone();
    list
}

#[tauri::command]
pub fn skill_add(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<Skill, String> {
    let skill = super::add(
        &app,
        name,
        description,
        body,
        enabled,
        user_invocable,
        disable_model_invocation,
        homepage,
        metadata,
    )?;
    sync_state(&app, &state);
    Ok(skill)
}

#[tauri::command]
pub fn skill_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<Skill, String> {
    let skill = super::update(
        &app,
        id,
        name,
        description,
        body,
        enabled,
        user_invocable,
        disable_model_invocation,
        homepage,
        metadata,
    )?;
    sync_state(&app, &state);
    Ok(skill)
}

#[tauri::command]
pub fn skill_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    super::remove(&app, id)?;
    sync_state(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn skill_export_md(app: AppHandle, id: String) -> Result<String, String> {
    let skill = super::list(&app)
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| "技能不存在".to_string())?;
    Ok(super::to_skill_md(&skill))
}
