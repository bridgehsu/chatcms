//! OpenClaw 风格多 Agent：角色人格、技能白名单、默认启用。

pub mod commands;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

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

/// 创建 workspace 目录树，返回根路径字符串
fn create_workspace(app: &AppHandle, slug: &str) -> Result<String, String> {
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

pub async fn ensure_seeded(app: &AppHandle) -> Vec<AgentProfile> {
    let mut list = crate::persist::load_all_agents(app).await;
    if list.is_empty() {
        list = bundled_agents();
        for agent in &list {
            crate::persist::save_agent(app, agent).await;
        }
    }
    list
}

pub async fn list(app: &AppHandle) -> Vec<AgentProfile> {
    let mut list = ensure_seeded(app).await;
    list.sort_by(|a, b| {
        a.sort
            .cmp(&b.sort)
            .then(b.enabled.cmp(&a.enabled))
            .then(b.updated.cmp(&a.updated))
            .then(a.name.cmp(&b.name))
    });
    list
}

pub async fn find_by_slug_or_id(app: &AppHandle, key: &str) -> Option<AgentProfile> {
    let key = key.trim();
    ensure_seeded(app)
        .await
        .into_iter()
        .find(|a| a.id == key || a.slug == key)
}

pub async fn add(
    app: &AppHandle,
    slug: String,
    name: String,
    remark: String,
    system_prompt: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    spawnable: bool,
    perms: std::collections::HashMap<String, crate::permission::DomainPolicy>,
    sort: i64,
) -> Result<AgentProfile, String> {
    let slug = validate_slug(&slug)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }

    let list = ensure_seeded(app).await;
    if list.iter().any(|a| a.slug == slug) {
        return Err(format!("已存在同 ID 代理「{slug}」"));
    }

    let workspace_dir = create_workspace(app, &slug)?;

    let ts = now_ms();
    let profile = AgentProfile {
        id: Uuid::new_v4().to_string(),
        slug,
        name,
        remark: remark.trim().to_string(),
        system_prompt: system_prompt.trim().to_string(),
        enabled,
        skills,
        spawnable,
        perms,
        workspace_dir: Some(workspace_dir),
        sort,
        created: ts,
        updated: ts,
    };
    crate::persist::save_agent(app, &profile).await;
    Ok(profile)
}

pub async fn update(
    app: &AppHandle,
    id: String,
    slug: String,
    name: String,
    remark: String,
    system_prompt: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    spawnable: bool,
    perms: std::collections::HashMap<String, crate::permission::DomainPolicy>,
    sort: i64,
) -> Result<AgentProfile, String> {
    let slug = validate_slug(&slug)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }

    let mut list = ensure_seeded(app).await;
    if list.iter().any(|a| a.slug == slug && a.id != id) {
        return Err(format!("已存在同 ID 代理「{slug}」"));
    }

    let profile = list
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| "代理不存在".to_string())?;
    profile.slug = slug;
    profile.name = name;
    profile.remark = remark.trim().to_string();
    profile.system_prompt = system_prompt.trim().to_string();
    profile.enabled = enabled;
    profile.skills = skills;
    profile.spawnable = spawnable;
    profile.perms = perms;
    profile.sort = sort;
    // workspace_dir 不允许修改，保留原值
    profile.updated = now_ms();

    let out = profile.clone();
    crate::persist::save_agent(app, &out).await;
    Ok(out)
}

pub async fn activate(app: &AppHandle, id: String) -> Result<AgentProfile, String> {
    let list = ensure_seeded(app).await;
    let profile = list
        .iter()
        .find(|a| a.id == id && a.enabled)
        .ok_or_else(|| "代理不存在或未启用".to_string())?
        .clone();

    if let Some(mut config) = crate::persist::load_config(app) {
        config.active_agent_id = Some(id);
        crate::persist::save_config(app, &config);
    }
    Ok(profile)
}

pub async fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let list = ensure_seeded(app).await;
    if list.len() <= 1 {
        return Err("至少保留一个代理".into());
    }
    if !list.iter().any(|a| a.id == id) {
        return Err("代理不存在".into());
    }
    crate::persist::delete_agent(app, &id).await;

    // 如果被删除的是当前激活代理，重置为第一个启用代理
    if let Some(mut config) = crate::persist::load_config(app) {
        if config.active_agent_id.as_deref() == Some(&id) {
            let new_active = list.iter().find(|a| a.id != id && a.enabled).map(|a| a.id.clone());
            config.active_agent_id = new_active;
            crate::persist::save_config(app, &config);
        }
    }
    Ok(())
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
