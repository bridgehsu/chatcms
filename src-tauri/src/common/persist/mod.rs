use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreBuilder};

mod config;
mod channels;
mod permission;
mod mpt;
mod business_map;
mod bridge;
mod crawler;

const STORE_FILE: &str = "chatcms.json";

pub(super) fn open(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, STORE_FILE).build().ok()
}

// Kept: domains without their own repository module
pub use config::*;
pub use channels::*;
pub use permission::{append_audit_event, load_permission_audit};
pub use mpt::*;
pub use business_map::*;
pub use bridge::*;
pub use crawler::*;
