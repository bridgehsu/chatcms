//! 内容管理 · AI 笔记（SQLite；可桥接 knowledge 供 Agent 检索）

pub mod commands;
pub mod repository;
pub mod service;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmsNote {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(default = "default_icon")]
    pub icon: String,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub source_session_id: Option<String>,
    #[serde(default)]
    pub source_session_title: Option<String>,
    #[serde(default)]
    pub source_message_id: Option<String>,
    /// 桥接的 knowledge 条目 id
    #[serde(default)]
    pub knowledge_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_icon() -> String {
    "📄".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmsNoteGroup {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesBundle {
    pub notes: Vec<CmsNote>,
    pub groups: Vec<CmsNoteGroup>,
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
