pub mod commands;
pub mod repository;
pub mod service;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub messages: Vec<Message>,
    pub created: u64,
    pub updated: u64,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub agent_id: Option<String>,
    /// 创建时从 AgentProfile 锁定的 workspace 路径，整个会话生命周期内不变
    #[serde(default)]
    pub workspace_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: Role,
    pub content: String,
    pub created: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
    System,
    Tool,
}

impl Session {
    pub fn new(title: impl Into<String>) -> Self {
        let now = now_secs();
        Self {
            id: Uuid::new_v4().to_string(),
            title: title.into(),
            messages: vec![],
            created: now,
            updated: now,
            pinned: false,
            agent_id: None,
            workspace_dir: None,
        }
    }

    pub fn new_with_agent(title: impl Into<String>, agent_id: String, workspace_dir: Option<String>) -> Self {
        let mut s = Self::new(title);
        s.agent_id = Some(agent_id);
        s.workspace_dir = workspace_dir;
        s
    }

    pub fn push(&mut self, role: Role, content: impl Into<String>) {
        let now = now_secs();
        self.messages.push(Message {
            id: Uuid::new_v4().to_string(),
            role,
            content: content.into(),
            created: now,
        });
        self.updated = now;
    }
}

pub(super) fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
