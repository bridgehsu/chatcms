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
mod agents;
mod business_map;
mod chat_bridge;

const STORE_FILE: &str = "chatcms.json";

pub(super) fn open(app: &AppHandle) -> Option<Arc<Store<tauri::Wry>>> {
    StoreBuilder::new(app, STORE_FILE).build().ok()
}

pub use sessions::*;
pub use config::*;
pub use mcp::*;
pub use knowledge::*;
pub use channels::*;
pub use images::*;
pub use videos::*;
pub use mpt::*;
pub use accounts::*;
pub use media_platforms::*;
pub use nav::*;
pub use schedules::*;
pub use skills::*;
pub use permission::*;
pub use agents::*;
pub use business_map::*;
pub use chat_bridge::*;
