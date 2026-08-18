use super::Skill;
use crate::agents::AgentState;
use tauri::{AppHandle, State};

async fn sync_state(app: &AppHandle, state: &State<'_, AgentState>) {
    *state.skills.lock().unwrap() = super::list(app).await;
}

#[tauri::command]
pub async fn skill_list(app: AppHandle, state: State<'_, AgentState>) -> Result<Vec<Skill>, String> {
    let list = super::list(&app).await;
    *state.skills.lock().unwrap() = list.clone();
    Ok(list)
}

#[tauri::command]
pub async fn skill_add(
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
        &app, name, description, body, enabled,
        user_invocable, disable_model_invocation, homepage, metadata,
    ).await?;
    sync_state(&app, &state).await;
    Ok(skill)
}

#[tauri::command]
pub async fn skill_update(
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
        &app, id, name, description, body, enabled,
        user_invocable, disable_model_invocation, homepage, metadata,
    ).await?;
    sync_state(&app, &state).await;
    Ok(skill)
}

#[tauri::command]
pub async fn skill_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    super::remove(&app, id).await?;
    sync_state(&app, &state).await;
    Ok(())
}

#[tauri::command]
pub async fn skill_install_npx(
    app: AppHandle,
    state: State<'_, AgentState>,
    pkg_name: String,
) -> Result<Vec<Skill>, String> {
    let skills = super::install_npx(&app, pkg_name).await?;
    sync_state(&app, &state).await;
    Ok(skills)
}

#[tauri::command]
pub fn skill_export_md(app: AppHandle, id: String) -> Result<String, String> {
    let rt = tokio::runtime::Handle::current();
    let skills = tokio::task::block_in_place(|| rt.block_on(super::list(&app)));
    let skill = skills.into_iter().find(|s| s.id == id)
        .ok_or_else(|| "技能不存在".to_string())?;
    Ok(super::to_skill_md(&skill))
}

#[allow(dead_code)]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("skills")
        .invoke_handler(tauri::generate_handler![
            skill_list,
            skill_add,
            skill_update,
            skill_remove,
            skill_install_npx,
            skill_export_md,
        ])
        .build()
}
