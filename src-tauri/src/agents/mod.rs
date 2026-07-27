//! OpenClaw 风格多 Agent：角色人格、技能白名单、默认启用。

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProfile {
    pub id: String,
    /// 短 id / slug（spawn_agent 可引用）
    pub slug: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// 人格 / 主题说明，注入 system prompt
    #[serde(default)]
    pub system_prompt: String,
    #[serde(default)]
    pub emoji: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 当前主会话使用的默认代理
    #[serde(default)]
    pub is_default: bool,
    /// None = 不限制（全部启用技能）；Some([]) = 无技能；Some([names]) = 白名单
    #[serde(default)]
    pub skills: Option<Vec<String>>,
    /// 是否允许被 spawn_agent 调用
    #[serde(default = "default_true")]
    pub allow_as_subagent: bool,
    /// 域策略覆盖（domain id → allow|ask|deny）
    #[serde(default)]
    pub permission_overrides: std::collections::HashMap<String, crate::permission::DomainPolicy>,
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_true() -> bool {
    true
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn validate_slug(slug: &str) -> Result<String, String> {
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

pub fn bundled_agents() -> Vec<AgentProfile> {
    let ts = now_ms();
    vec![
        AgentProfile {
            id: "agent-main".into(),
            slug: "main".into(),
            name: "默认助手".into(),
            description: "通用主代理，负责日常对话与工具编排。".into(),
            system_prompt: "你是 ChatCMS 的默认助手。简洁、可靠，优先完成用户目标；需要时调用工具与技能。".into(),
            emoji: "🤖".into(),
            enabled: true,
            is_default: true,
            skills: None,
            allow_as_subagent: true,
            permission_overrides: std::collections::HashMap::new(),
            created_at: ts,
            updated_at: ts,
        },
        AgentProfile {
            id: "agent-writer".into(),
            slug: "writer".into(),
            name: "内容写手".into(),
            description: "专注多平台文案、标题与发布结构。".into(),
            system_prompt: "你是资深内容写手。输出可直接发布的成稿，关注平台语气、钩子与可读性。优先遵循 content-publish 技能。".into(),
            emoji: "✍️".into(),
            enabled: true,
            is_default: false,
            skills: Some(vec!["content-publish".into(), "image-brief".into()]),
            allow_as_subagent: true,
            permission_overrides: std::collections::HashMap::new(),
            created_at: ts,
            updated_at: ts,
        },
        AgentProfile {
            id: "agent-researcher".into(),
            slug: "researcher".into(),
            name: "调研助手".into(),
            description: "拆解问题、检索资料并给出结构化结论。".into(),
            system_prompt: "你是调研助手。先列提纲再收集要点，区分事实与推断，给出可执行的下一步。".into(),
            emoji: "🔎".into(),
            enabled: true,
            is_default: false,
            skills: None,
            allow_as_subagent: true,
            permission_overrides: std::collections::HashMap::new(),
            created_at: ts,
            updated_at: ts,
        },
    ]
}

pub fn ensure_seeded(app: &AppHandle) -> Vec<AgentProfile> {
    let mut list = crate::persist::load_agent_profiles(app);
    if list.is_empty() {
        list = bundled_agents();
        crate::persist::save_agent_profiles(app, &list);
        return list;
    }

    if !list.iter().any(|a| a.is_default) {
        if let Some(first) = list.iter_mut().find(|a| a.enabled) {
            first.is_default = true;
            crate::persist::save_agent_profiles(app, &list);
        }
    }
    list
}

pub fn list(app: &AppHandle) -> Vec<AgentProfile> {
    let mut list = ensure_seeded(app);
    list.sort_by(|a, b| {
        b.is_default
            .cmp(&a.is_default)
            .then(b.enabled.cmp(&a.enabled))
            .then(b.updated_at.cmp(&a.updated_at))
            .then(a.name.cmp(&b.name))
    });
    list
}

pub fn get_default(app: &AppHandle) -> Option<AgentProfile> {
    let list = ensure_seeded(app);
    list.iter()
        .find(|a| a.is_default && a.enabled)
        .cloned()
        .or_else(|| list.into_iter().find(|a| a.enabled))
}

pub fn find_by_slug_or_id(app: &AppHandle, key: &str) -> Option<AgentProfile> {
    let key = key.trim();
    ensure_seeded(app)
        .into_iter()
        .find(|a| a.id == key || a.slug == key)
}

pub fn add(
    app: &AppHandle,
    slug: String,
    name: String,
    description: String,
    system_prompt: String,
    emoji: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    allow_as_subagent: bool,
    permission_overrides: std::collections::HashMap<String, crate::permission::DomainPolicy>,
) -> Result<AgentProfile, String> {
    let slug = validate_slug(&slug)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }

    let mut list = ensure_seeded(app);
    if list.iter().any(|a| a.slug == slug) {
        return Err(format!("已存在同 ID 代理「{slug}」"));
    }

    let ts = now_ms();
    let make_default = !list.iter().any(|a| a.is_default);
    let profile = AgentProfile {
        id: Uuid::new_v4().to_string(),
        slug,
        name,
        description: description.trim().to_string(),
        system_prompt: system_prompt.trim().to_string(),
        emoji: emoji.trim().to_string(),
        enabled,
        is_default: make_default,
        skills,
        allow_as_subagent,
        permission_overrides,
        created_at: ts,
        updated_at: ts,
    };
    list.push(profile.clone());
    crate::persist::save_agent_profiles(app, &list);
    Ok(profile)
}

pub fn update(
    app: &AppHandle,
    id: String,
    slug: String,
    name: String,
    description: String,
    system_prompt: String,
    emoji: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    allow_as_subagent: bool,
    permission_overrides: std::collections::HashMap<String, crate::permission::DomainPolicy>,
) -> Result<AgentProfile, String> {
    let slug = validate_slug(&slug)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }

    let mut list = ensure_seeded(app);
    if list.iter().any(|a| a.slug == slug && a.id != id) {
        return Err(format!("已存在同 ID 代理「{slug}」"));
    }

    let profile = list
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| "代理不存在".to_string())?;
    profile.slug = slug;
    profile.name = name;
    profile.description = description.trim().to_string();
    profile.system_prompt = system_prompt.trim().to_string();
    profile.emoji = emoji.trim().to_string();
    profile.enabled = enabled;
    profile.skills = skills;
    profile.allow_as_subagent = allow_as_subagent;
    profile.permission_overrides = permission_overrides;
    profile.updated_at = now_ms();

    if !profile.enabled && profile.is_default {
        profile.is_default = false;
    }

    let out = profile.clone();

    if !list.iter().any(|a| a.is_default && a.enabled) {
        if let Some(first) = list.iter_mut().find(|a| a.enabled) {
            first.is_default = true;
        }
    }

    crate::persist::save_agent_profiles(app, &list);
    Ok(out)
}

pub fn activate(app: &AppHandle, id: String) -> Result<AgentProfile, String> {
    let mut list = ensure_seeded(app);
    let exists = list.iter().any(|a| a.id == id);
    if !exists {
        return Err("代理不存在".into());
    }
    for a in list.iter_mut() {
        a.is_default = a.id == id;
        if a.is_default {
            a.enabled = true;
            a.updated_at = now_ms();
        }
    }
    crate::persist::save_agent_profiles(app, &list);
    list.into_iter()
        .find(|a| a.id == id)
        .ok_or_else(|| "激活失败".into())
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = ensure_seeded(app);
    if list.len() <= 1 {
        return Err("至少保留一个代理".into());
    }
    let was_default = list.iter().any(|a| a.id == id && a.is_default);
    let before = list.len();
    list.retain(|a| a.id != id);
    if list.len() == before {
        return Err("代理不存在".into());
    }
    if was_default {
        if let Some(first) = list.iter_mut().find(|a| a.enabled) {
            first.is_default = true;
        } else if let Some(first) = list.first_mut() {
            first.is_default = true;
            first.enabled = true;
        }
    }
    crate::persist::save_agent_profiles(app, &list);
    Ok(())
}

/// 拼进 system prompt 的人格块。
pub fn format_persona(agent: &AgentProfile) -> String {
    let mut parts = vec!["<agent>".to_string()];
    let title = if agent.emoji.is_empty() {
        agent.name.clone()
    } else {
        format!("{} {}", agent.emoji, agent.name)
    };
    parts.push(format!("You are acting as **{}** (`{}`).", title, agent.slug));
    if !agent.description.is_empty() {
        parts.push(agent.description.clone());
    }
    if !agent.system_prompt.is_empty() {
        parts.push(agent.system_prompt.clone());
    }
    parts.push("</agent>".to_string());
    parts.join("\n\n")
}
