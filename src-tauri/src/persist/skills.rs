use tauri::AppHandle;

use crate::skills::Skill;

pub fn save_skills(app: &AppHandle, skills: &[Skill]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(skills).unwrap_or_default();
    store.set("skills", val);
    let _ = store.save();
}

pub fn load_skills(app: &AppHandle) -> Vec<Skill> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("skills")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
