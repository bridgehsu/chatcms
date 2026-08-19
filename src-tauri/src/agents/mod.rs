//! OpenClaw 风格多 Agent：角色人格、技能白名单、默认启用。

pub mod commands;
pub mod repository;
pub mod service;
pub mod state;
pub mod dispatch;
pub mod subagent;
pub mod tools;

pub use tools::{ToolCall, ToolDef, ToolResult};

pub use state::{AgentState, PermissionUserReply};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProfile {
    pub id: String,
    /// 短标识（spawn_agent 引用用，仅小写字母/数字/连字符/下划线）
    pub slug: String,
    pub name: String,
    /// 简介 / 备注
    #[serde(default)]
    pub remark: String,
    /// 人格 / 角色系统提示词
    #[serde(default)]
    pub system_prompt: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// None = 不限制（全部启用技能）；Some([]) = 无技能；Some([names]) = 白名单
    #[serde(default)]
    pub skills: Option<Vec<String>>,
    /// 是否允许被 spawn_agent 调用
    #[serde(default = "default_true")]
    pub spawnable: bool,
    /// 域策略覆盖（domain id → allow|ask|deny）
    #[serde(default)]
    pub perms: std::collections::HashMap<String, crate::permission::DomainPolicy>,
    /// 独立工作目录，新增时自动创建，路径基于 slug
    #[serde(default)]
    pub workspace_dir: Option<String>,
    /// 排序权重（越小越靠前）
    #[serde(default)]
    pub sort: i64,
    pub created: i64,
    pub updated: i64,
}

fn default_true() -> bool {
    true
}

pub(super) fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub(super) fn validate_slug(slug: &str) -> Result<String, String> {
    let slug = slug.trim().to_lowercase();
    if slug.is_empty() {
        return Err("代理 ID 不能为空".into());
    }
    if !slug
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
    {
        return Err("代理 ID 仅允许小写字母、数字、连字符与下划线".into());
    }
    Ok(slug)
}

/// 创建 workspace 目录树，返回根路径字符串
pub(super) fn create_workspace(app: &AppHandle, slug: &str) -> Result<String, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("workspaces")
        .join(slug);
    for sub in &["input", "output", "tmp", "memory", "logs"] {
        std::fs::create_dir_all(base.join(sub))
            .map_err(|e| format!("创建 workspace/{sub} 失败: {e}"))?;
    }
    Ok(base.to_string_lossy().to_string())
}

pub fn bundled_agents() -> Vec<AgentProfile> {
    let ts = now_ms();
    vec![
        AgentProfile {
            id: "agent-main".into(),
            slug: "main".into(),
            name: "默认助手".into(),
            remark: "通用主代理，负责日常对话与工具编排。".into(),
            system_prompt: "你是 ChatCMS 的默认助手。简洁、可靠，优先完成用户目标；需要时调用工具与技能。".into(),
            enabled: true,
            skills: None,
            spawnable: true,
            perms: std::collections::HashMap::new(),
            workspace_dir: None,
            sort: 0,
            created: ts,
            updated: ts,
        },
        AgentProfile {
            id: "agent-writer".into(),
            slug: "writer".into(),
            name: "内容写手".into(),
            remark: "专注多平台文案、标题与发布结构。".into(),
            system_prompt: "你是资深内容写手。输出可直接发布的成稿，关注平台语气、钩子与可读性。优先遵循 content-publish 技能。".into(),
            enabled: true,
            skills: Some(vec!["content-publish".into(), "image-brief".into()]),
            spawnable: true,
            perms: std::collections::HashMap::new(),
            workspace_dir: None,
            sort: 1,
            created: ts,
            updated: ts,
        },
        AgentProfile {
            id: "agent-researcher".into(),
            slug: "researcher".into(),
            name: "调研助手".into(),
            remark: "拆解问题、检索资料并给出结构化结论。".into(),
            system_prompt: "你是调研助手。先列提纲再收集要点，区分事实与推断，给出可执行的下一步。".into(),
            enabled: true,
            skills: None,
            spawnable: true,
            perms: std::collections::HashMap::new(),
            workspace_dir: None,
            sort: 2,
            created: ts,
            updated: ts,
        },
    ]
}

/// 拼进 system prompt 的人格块。
pub fn format_persona(agent: &AgentProfile) -> String {
    let mut parts = vec!["<agent>".to_string()];
    parts.push(format!("You are acting as **{}** (`{}`).", agent.name, agent.slug));
    if !agent.remark.is_empty() {
        parts.push(agent.remark.clone());
    }
    if !agent.system_prompt.is_empty() {
        parts.push(agent.system_prompt.clone());
    }
    parts.push("</agent>".to_string());
    parts.join("\n\n")
}
