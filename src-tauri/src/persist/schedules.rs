use tauri::AppHandle;

use crate::schedules::ScheduleProject;

pub fn save_schedule_projects(app: &AppHandle, projects: &[ScheduleProject]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(projects).unwrap_or_default();
    store.set("schedule_projects", val);
    let _ = store.save();
}

pub fn load_schedule_projects(app: &AppHandle) -> Vec<ScheduleProject> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("schedule_projects")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
