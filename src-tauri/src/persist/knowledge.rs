use tauri::AppHandle;

use crate::knowledge::{KnowledgeEntry, KnowledgeSiteProfile};

pub fn save_knowledge(app: &AppHandle, entries: &[KnowledgeEntry]) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(entries).unwrap_or_default();
    store.set("knowledge", val);
    let _ = store.save();
}

pub fn load_knowledge(app: &AppHandle) -> Vec<KnowledgeEntry> {
    let Some(store) = super::open(app) else { return vec![] };
    store
        .get("knowledge")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_knowledge_site_profile(app: &AppHandle, profile: &KnowledgeSiteProfile) {
    let Some(store) = super::open(app) else { return };
    let val = serde_json::to_value(profile).unwrap_or_default();
    store.set("knowledge_site_profile", val);
    let _ = store.save();
}

pub fn load_knowledge_site_profile(app: &AppHandle) -> KnowledgeSiteProfile {
    let Some(store) = super::open(app) else {
        return KnowledgeSiteProfile::default();
    };
    store
        .get("knowledge_site_profile")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
