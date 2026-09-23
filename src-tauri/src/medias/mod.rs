//! 媒体管理：发布平台元数据 + 按类型独立的填表脚本（draft / published）。

pub mod commands;
pub mod repository;

mod multipost_catalog;
mod service;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaPlatform {
    pub id: String,
    pub code: String,
    pub name: String,
    /// dynamic | article | video | podcast
    pub kind: String,
    #[serde(default)]
    pub inject_url: String,
    #[serde(default)]
    pub home_url: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub notes: String,
    /// cn | intl
    #[serde(default = "default_region")]
    pub region: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishScript {
    pub id: String,
    pub platform_id: String,
    pub kind: String,
    #[serde(default)]
    pub draft_script: String,
    #[serde(default)]
    pub published_script: String,
    #[serde(default)]
    pub published_version: u32,
    #[serde(default)]
    pub match_url: String,
    #[serde(default)]
    pub changelog: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishScriptView {
    #[serde(flatten)]
    pub script: PublishScript,
    pub has_unpublished_draft: bool,
    pub is_published: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaPlatformPageItem {
    #[serde(flatten)]
    pub platform: MediaPlatform,
    pub script_is_published: bool,
    pub script_has_unpublished_draft: bool,
    pub script_published_version: u32,
    #[serde(default)]
    pub collect_script_is_published: bool,
    #[serde(default)]
    pub collect_script_has_unpublished_draft: bool,
    #[serde(default)]
    pub collect_script_published_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaPlatformPage {
    pub items: Vec<MediaPlatformPageItem>,
    pub total: u64,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgePlatform {
    pub id: String,
    pub code: String,
    pub name: String,
    pub kind: String,
    pub inject_url: String,
    pub home_url: String,
    #[serde(default = "default_region")]
    pub region: String,
    pub has_script: bool,
    pub script_version: u32,
    #[serde(default)]
    pub has_collect_script: bool,
    #[serde(default)]
    pub collect_script_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeScript {
    pub platform_id: String,
    pub code: String,
    pub kind: String,
    pub script: String,
    pub version: u32,
    pub match_url: String,
}

pub(crate) fn default_true() -> bool {
    true
}

pub(crate) fn default_region() -> String {
    "cn".into()
}

pub(crate) fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn normalize_kind(kind: &str) -> Result<String, String> {
    let k = kind.trim().to_lowercase();
    match k.as_str() {
        "dynamic" | "article" | "video" | "podcast" => Ok(k),
        _ => Err("类型须为 dynamic / article / video / podcast".into()),
    }
}

pub(crate) fn normalize_region(region: &str) -> String {
    match region.trim().to_lowercase().as_str() {
        "intl" | "overseas" | "global" => "intl".into(),
        _ => "cn".into(),
    }
}

pub(crate) fn script_view(s: PublishScript) -> PublishScriptView {
    let is_published = s.published_version > 0 && !s.published_script.is_empty();
    let has_unpublished_draft = s.draft_script != s.published_script;
    PublishScriptView {
        script: s,
        has_unpublished_draft,
        is_published,
    }
}

pub use service::{
    list_platforms, list_platforms_page, get_platform, upsert_platform,
    set_platform_enabled, remove_platform, list_scripts, get_or_create_script, save_script_draft,
    publish_script, discard_script_draft, bridge_list_platforms, bridge_get_script,
    bridge_get_collect_script, list_collect_scripts, get_or_create_collect_script,
    save_collect_script_draft, publish_collect_script, discard_collect_script_draft,
    migrate_and_seed,
};
