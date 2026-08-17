use tauri::AppHandle;

use super::AgentProfile;
use crate::config::AppConfig;

pub async fn load_all(app: &AppHandle) -> Vec<AgentProfile> {
    crate::persist::load_all_agents(app).await
}

pub async fn save(app: &AppHandle, agent: &AgentProfile) {
    crate::persist::save_agent(app, agent).await;
}

pub async fn delete(app: &AppHandle, id: &str) {
    crate::persist::delete_agent(app, id).await;
}

pub fn load_config(app: &AppHandle) -> Option<AppConfig> {
    crate::persist::load_config(app)
}

pub fn save_config(app: &AppHandle, config: &AppConfig) {
    crate::persist::save_config(app, config);
}
