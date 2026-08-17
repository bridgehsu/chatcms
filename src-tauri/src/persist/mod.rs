use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

mod sessions;
mod config;
mod mcp;
mod knowledge;
mod channels;
mod images;
mod videos;
mod mpt;
mod accounts;
mod media_platforms;
mod nav;
mod schedules;
mod skills;
mod permission;
mod business_map;
mod bridge;
mod crawler;

const STORE_FILE: &str = "chatcms.json";

pub(super) fn open(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, STORE_FILE).build().ok()
}

// Sessions (SQLite)
pub use sessions::{save_session, delete_session, load_all_sessions};

// Knowledge (SQLite)
pub use knowledge::{
    save_knowledge_entry,
    delete_knowledge_entry,
    load_all_knowledge,
    save_knowledge_site_profile,
    load_knowledge_site_profile,
};

// Permission audit (SQLite)
pub use permission::{append_audit_event, load_permission_audit};

// Skills (SQLite)
pub use skills::{save_skill, delete_skill, load_all_skills};

// Remaining store-based persists
pub use config::*;
pub use mcp::*;
pub use channels::*;
pub use images::{save_image, delete_image, load_all_images};
pub use videos::{save_video, delete_video, load_all_videos};
pub use mpt::*;
pub use accounts::*;
pub use media_platforms::*;
pub use nav::*;
pub use schedules::*;
pub use business_map::*;
pub use bridge::*;
pub use crawler::*;
