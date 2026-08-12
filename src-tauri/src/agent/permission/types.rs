use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunMode {
    /// 观察模式：危险域强制确认或拒绝倾向
    Observe,
    /// 协助模式：默认，严格按域策略
    Assist,
    /// 自动模式：尊重用户把域设为 allow 的自动放行
    Trust,
}

impl Default for RunMode {
    fn default() -> Self {
        Self::Assist
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Domain {
    FileRead,
    FileWrite,
    Shell,
    Mcp,
    Agent,
    Network,
    Browser,
    App,
}

impl Domain {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::FileRead => "file_read",
            Self::FileWrite => "file_write",
            Self::Shell => "shell",
            Self::Mcp => "mcp",
            Self::Agent => "agent",
            Self::Network => "network",
            Self::Browser => "browser",
            Self::App => "app",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::FileRead => "文件读取",
            Self::FileWrite => "文件写入",
            Self::Shell => "终端",
            Self::Mcp => "MCP",
            Self::Agent => "子代理",
            Self::Network => "网络",
            Self::Browser => "浏览器",
            Self::App => "应用",
        }
    }

    pub fn all() -> &'static [Domain] {
        &[
            Self::FileRead,
            Self::FileWrite,
            Self::Shell,
            Self::Mcp,
            Self::Agent,
            Self::Network,
            Self::Browser,
            Self::App,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DomainPolicy {
    Allow,
    Ask,
    Deny,
}

impl Default for DomainPolicy {
    fn default() -> Self {
        Self::Ask
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RememberScope {
    Once,
    SessionAllow,
    SessionDeny,
}

impl Default for RememberScope {
    fn default() -> Self {
        Self::Once
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditDecision {
    AllowAuto,
    AllowUser,
    DenyUser,
    DenyPolicy,
    DenyTimeout,
    DenyConstraint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Allow,
    Deny { reason: String },
    Ask,
}

/// UI 用：域列表说明
#[derive(Debug, Clone, Serialize)]
pub struct DomainInfo {
    pub id: String,
    pub label: String,
    pub policy: DomainPolicy,
}
