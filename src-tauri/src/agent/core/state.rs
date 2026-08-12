//! Agent 全局状态：由 Tauri `manage` 注入，各命令与循环共享。

use std::collections::HashMap;
use std::sync::Mutex;

use tokio::sync::oneshot;

use crate::agents::AgentProfile;
use crate::channels::ChannelState;
use crate::config::AppConfig;
use crate::kbase::KnowledgeEntry;
use crate::mcp::McpManager;
use crate::memory::Session;
use crate::permission::{RememberScope, SessionGrantStore};
use crate::skills::Skill;

/// 前端权限回执
#[derive(Debug, Clone)]
pub struct PermissionUserReply {
    pub allowed: bool,
    pub remember: RememberScope,
}

/// 应用级 Agent 状态（配置、会话、MCP、知识库、技能、代理档案、频道等）。
pub struct AgentState {
    pub config: Mutex<AppConfig>,
    pub sessions: Mutex<HashMap<String, Session>>,
    pub pending_permissions: Mutex<HashMap<String, oneshot::Sender<PermissionUserReply>>>,
    pub session_grants: Mutex<SessionGrantStore>,
    pub mcp: tokio::sync::Mutex<McpManager>,
    pub knowledge: Mutex<Vec<KnowledgeEntry>>,
    pub skills: Mutex<Vec<Skill>>,
    pub agents: Mutex<Vec<AgentProfile>>,
    pub channel: tokio::sync::Mutex<ChannelState>,
}

impl AgentState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            sessions: Mutex::new(HashMap::new()),
            pending_permissions: Mutex::new(HashMap::new()),
            session_grants: Mutex::new(SessionGrantStore::default()),
            mcp: tokio::sync::Mutex::new(McpManager::new(HashMap::new())),
            knowledge: Mutex::new(Vec::new()),
            skills: Mutex::new(Vec::new()),
            agents: Mutex::new(Vec::new()),
            channel: tokio::sync::Mutex::new(ChannelState::default()),
        }
    }
}
