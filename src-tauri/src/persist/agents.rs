use tauri::AppHandle;

use crate::agents::AgentProfile;

pub fn save_agent_profiles(app: &AppHandle, agents: &[AgentProfile]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(agents).unwrap_or_default();
    store.set("agent_profiles", val);
    let _ = store.save();
}

pub fn load_agent_profiles(app: &AppHandle) -> Vec<AgentProfile> {
    let Some(store) = super::open(app) else {
        return vec![];
    };
    store
        .get("agent_profiles")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
