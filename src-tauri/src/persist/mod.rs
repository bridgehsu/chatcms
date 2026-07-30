use std::collections::HashMap;
use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

use crate::accounts::PlatformAccount;
use crate::agents::AgentProfile;
use crate::channels::ChannelConfig;
use crate::config::AppConfig;
use crate::images::GeneratedImage;
use crate::knowledge::KnowledgeEntry;
use crate::mcp::McpServerConfig;
use crate::media_platforms::{MediaPlatform, PublishScript};
use crate::memory::Session;
use crate::nav_bookmarks::NavBookmark;
use crate::schedules::ScheduleProject;
use crate::skills::Skill;
use crate::videos::GeneratedVideo;

const STORE_FILE: &str = "chatcms.json";

fn open(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, STORE_FILE).build().ok()
}

// ── Public API ────────────────────────────────────────────────────────────────

pub fn save_sessions(app: &AppHandle, sessions: &HashMap<String, Session>) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(sessions).unwrap_or_default();
    store.set("sessions", val);
    let _ = store.save();
}

pub fn save_config(app: &AppHandle, config: &AppConfig) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(config).unwrap_or_default();
    store.set("config", val);
    let _ = store.save();
}

pub fn load_sessions(app: &AppHandle) -> HashMap<String, Session> {
    let Some(store) = open(app) else {
        return HashMap::new();
    };
    store
        .get("sessions")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn load_config(app: &AppHandle) -> Option<AppConfig> {
    let store = open(app)?;
    store.get("config").and_then(|v| serde_json::from_value(v).ok())
}

pub fn save_mcp_configs(app: &AppHandle, configs: &HashMap<String, McpServerConfig>) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(configs).unwrap_or_default();
    store.set("mcp_servers", val);
    let _ = store.save();
}

pub fn load_mcp_configs(app: &AppHandle) -> HashMap<String, McpServerConfig> {
    let Some(store) = open(app) else {
        return HashMap::new();
    };
    store
        .get("mcp_servers")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_knowledge(app: &AppHandle, entries: &[KnowledgeEntry]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(entries).unwrap_or_default();
    store.set("knowledge", val);
    let _ = store.save();
}

pub fn load_knowledge(app: &AppHandle) -> Vec<KnowledgeEntry> {
    let Some(store) = open(app) else { return vec![] };
    store
        .get("knowledge")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_channel_config(app: &AppHandle, config: &ChannelConfig) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(config).unwrap_or_default();
    store.set("channel_config", val);
    let _ = store.save();
}

pub fn load_channel_config(app: &AppHandle) -> ChannelConfig {
    let Some(store) = open(app) else {
        return ChannelConfig::default();
    };
    let mut cfg: ChannelConfig = store
        .get("channel_config")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    cfg.migrate_legacy();
    cfg
}

pub fn save_images(app: &AppHandle, images: &[GeneratedImage]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(images).unwrap_or_default();
    store.set("generated_images", val);
    let _ = store.save();
}

pub fn load_images(app: &AppHandle) -> Vec<GeneratedImage> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("generated_images")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_videos(app: &AppHandle, videos: &[GeneratedVideo]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(videos).unwrap_or_default();
    store.set("generated_videos", val);
    let _ = store.save();
}

pub fn load_videos(app: &AppHandle) -> Vec<GeneratedVideo> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("generated_videos")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_accounts(app: &AppHandle, accounts: &[PlatformAccount]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(accounts).unwrap_or_default();
    store.set("platform_accounts", val);
    let _ = store.save();
}

pub fn load_accounts(app: &AppHandle) -> Vec<PlatformAccount> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("platform_accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_media_platforms(app: &AppHandle, platforms: &[MediaPlatform]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(platforms).unwrap_or_default();
    store.set("media_platforms", val);
    let _ = store.save();
}

pub fn load_media_platforms(app: &AppHandle) -> Vec<MediaPlatform> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("media_platforms")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_publish_scripts(app: &AppHandle, scripts: &[PublishScript]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(scripts).unwrap_or_default();
    store.set("publish_scripts", val);
    let _ = store.save();
}

pub fn load_publish_scripts(app: &AppHandle) -> Vec<PublishScript> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("publish_scripts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_collect_scripts(app: &AppHandle, scripts: &[PublishScript]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(scripts).unwrap_or_default();
    store.set("collect_scripts", val);
    let _ = store.save();
}

pub fn load_collect_scripts(app: &AppHandle) -> Vec<PublishScript> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("collect_scripts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_nav_bookmarks(app: &AppHandle, bookmarks: &[NavBookmark]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(bookmarks).unwrap_or_default();
    store.set("nav_bookmarks", val);
    let _ = store.save();
}

pub fn load_nav_bookmarks(app: &AppHandle) -> Vec<NavBookmark> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("nav_bookmarks")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_schedule_projects(app: &AppHandle, projects: &[ScheduleProject]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(projects).unwrap_or_default();
    store.set("schedule_projects", val);
    let _ = store.save();
}

pub fn load_schedule_projects(app: &AppHandle) -> Vec<ScheduleProject> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("schedule_projects")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_skills(app: &AppHandle, skills: &[Skill]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(skills).unwrap_or_default();
    store.set("skills", val);
    let _ = store.save();
}

pub fn load_skills(app: &AppHandle) -> Vec<Skill> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("skills")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_permission_audit(app: &AppHandle, events: &[crate::permission::AuditEvent]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(events).unwrap_or_default();
    store.set("permission_audit", val);
    let _ = store.save();
}

pub fn load_permission_audit(app: &AppHandle) -> Vec<crate::permission::AuditEvent> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("permission_audit")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save_agent_profiles(app: &AppHandle, agents: &[AgentProfile]) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(agents).unwrap_or_default();
    store.set("agent_profiles", val);
    let _ = store.save();
}

pub fn load_agent_profiles(app: &AppHandle) -> Vec<AgentProfile> {
    let Some(store) = open(app) else {
        return vec![];
    };
    store
        .get("agent_profiles")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

/// 浏览器扩展 page_key → session_id 绑定。
pub fn save_page_bindings(app: &AppHandle, bindings: &HashMap<String, String>) {
    let Some(store) = open(app) else { return };
    let val = serde_json::to_value(bindings).unwrap_or_default();
    store.set("page_bindings", val);
    let _ = store.save();
}

pub fn load_page_bindings(app: &AppHandle) -> HashMap<String, String> {
    let Some(store) = open(app) else {
        return HashMap::new();
    };
    store
        .get("page_bindings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
