use super::{ScheduleProject, WorkflowGraph};
use tauri::AppHandle;

#[tauri::command]
pub fn schedule_list(app: AppHandle) -> Vec<ScheduleProject> {
    super::list(&app)
}

#[tauri::command]
pub fn schedule_get(app: AppHandle, id: String) -> Result<ScheduleProject, String> {
    super::get(&app, &id)
}

#[tauri::command]
pub fn schedule_add(
    app: AppHandle,
    name: String,
    description: String,
    enabled: bool,
) -> Result<ScheduleProject, String> {
    super::add(&app, name, description, enabled)
}

#[tauri::command]
pub fn schedule_update(
    app: AppHandle,
    id: String,
    name: String,
    description: String,
    enabled: bool,
) -> Result<ScheduleProject, String> {
    super::update_meta(&app, id, name, description, enabled)
}

#[tauri::command]
pub fn schedule_save_workflow(
    app: AppHandle,
    id: String,
    workflow: WorkflowGraph,
) -> Result<ScheduleProject, String> {
    super::save_workflow(&app, id, workflow)
}

#[tauri::command]
pub fn schedule_remove(app: AppHandle, id: String) -> Result<(), String> {
    super::remove(&app, id)
}
#[allow(dead_code)]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("schedules")
        .invoke_handler(tauri::generate_handler![
            schedule_list,
            schedule_get,
            schedule_add,
            schedule_update,
            schedule_save_workflow,
            schedule_remove,
        ])
        .build()
}
