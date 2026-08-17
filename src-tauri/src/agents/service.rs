use std::collections::HashMap;
use tauri::AppHandle;
use uuid::Uuid;

use super::repository as repo;
use super::{bundled_agents, create_workspace, now_ms, validate_slug, AgentProfile};
use crate::permission::DomainPolicy;

pub async fn ensure_seeded(app: &AppHandle) -> Vec<AgentProfile> {
    let mut list = repo::load_all(app).await;
    if list.is_empty() {
        // 首次启动：写入内置 agent 并创建各自的 workspace
        list = bundled_agents();
        for agent in list.iter_mut() {
            if let Ok(ws) = create_workspace(app, &agent.slug) {
                agent.workspace_dir = Some(ws);
            }
            repo::save(app, agent).await;
        }
    } else {
        // 迁移：为存量 workspace_dir 为空的 agent 补建目录
        let mut changed = false;
        for agent in list.iter_mut() {
            if agent.workspace_dir.is_none() {
                if let Ok(ws) = create_workspace(app, &agent.slug) {
                    agent.workspace_dir = Some(ws);
                    repo::save(app, agent).await;
                    changed = true;
                }
            }
        }
        let _ = changed; // 保留占位，便于日后加日志
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
    perms: HashMap<String, DomainPolicy>,
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
    repo::save(app, &profile).await;
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
    perms: HashMap<String, DomainPolicy>,
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
    profile.updated = now_ms();

    let out = profile.clone();
    repo::save(app, &out).await;
    Ok(out)
}

pub async fn activate(app: &AppHandle, id: String) -> Result<AgentProfile, String> {
    let list = ensure_seeded(app).await;
    let profile = list
        .iter()
        .find(|a| a.id == id && a.enabled)
        .ok_or_else(|| "代理不存在或未启用".to_string())?
        .clone();

    if let Some(mut config) = repo::load_config(app) {
        config.active_agent_id = Some(id);
        repo::save_config(app, &config);
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
    repo::delete(app, &id).await;

    if let Some(mut config) = repo::load_config(app) {
        if config.active_agent_id.as_deref() == Some(&id) {
            let new_active = list.iter().find(|a| a.id != id && a.enabled).map(|a| a.id.clone());
            config.active_agent_id = new_active;
            repo::save_config(app, &config);
        }
    }
    Ok(())
}
