//! Agent 全局状态：由 Tauri `manage` 注入，各命令与循环共享。

use std::collections::HashMap;
use std::sync::Mutex;

use tokio::sync::oneshot;

use crate::channels::ChannelState;
use crate::config::AppConfig;
use crate::knowledge::KnowledgeEntry;
use crate::mcp::McpManager;
use crate::memory::Session;

/// 应用级 Agent 状态（配置、会话、MCP、知识库、频道等）。
pub struct AgentState {
    /// Provider / 模型等配置
    pub config: Mutex<AppConfig>,
    /// 会话表：session_id → Session
    pub sessions: Mutex<HashMap<String, Session>>,
    /// 等待前端确认的危险工具调用（request_id → oneshot）
    pub pending_permissions: Mutex<HashMap<String, oneshot::Sender<bool>>>,
    /// MCP 子进程管理器
    pub mcp: tokio::sync::Mutex<McpManager>,
    /// 知识库条目（检索后注入 system prompt）
    pub knowledge: Mutex<Vec<KnowledgeEntry>>,
    /// 外部频道（如 Telegram）
    pub channel: tokio::sync::Mutex<ChannelState>,
}

impl AgentState {
    /// 创建空状态；真正数据在 `lib.rs` bootstrap 时从 persist 加载。
    pub fn new() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            sessions: Mutex::new(HashMap::new()),
            pending_permissions: Mutex::new(HashMap::new()),
            mcp: tokio::sync::Mutex::new(McpManager::new(HashMap::new())),
            knowledge: Mutex::new(Vec::new()),
            channel: tokio::sync::Mutex::new(ChannelState::default()),
        }
    }
}
