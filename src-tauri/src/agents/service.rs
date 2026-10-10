use std::collections::HashMap;
use tauri::AppHandle;
use uuid::Uuid;

use super::repository as repo;
use super::{
    bundled_agents, create_workspace, now_ms, parse_script_key, script_key, validate_slug,
    AgentChannelScript, AgentProfile,
};
use crate::common::permission::DomainPolicy;
use crate::medias;

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

fn normalize_scripts(raw: Option<Vec<String>>) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for key in raw.unwrap_or_default() {
        let Some((kind, id)) = parse_script_key(&key) else {
            continue;
        };
        let k = script_key(&kind, &id);
        if seen.insert(k.clone()) {
            out.push(k);
        }
    }
    out
}

/// 可绑定的渠道脚本目录（已发布脚本包为主；兼容旧平台采集/填表）。
pub fn list_script_options(app: &AppHandle) -> Vec<AgentChannelScript> {
    let mut items: Vec<AgentChannelScript> = medias::packages::list_published_for_bridge(app)
        .into_iter()
        .map(|p| AgentChannelScript {
            key: script_key("script", &p.id),
            role: "read".into(),
            kind: "script".into(),
            platform_id: p.id.clone(),
            code: p.code.clone(),
            label: p.name.clone(),
            version: p.published_version,
            match_url: String::new(),
        })
        .collect();

    // 尚未迁成包、但仍有已发布采集/填表的旧平台
    for p in medias::bridge_list_platforms(app) {
        if items.iter().any(|i| i.platform_id == p.id || i.code == p.code) {
            continue;
        }
        if p.has_collect_script {
            items.push(AgentChannelScript {
                key: script_key("collect", &p.id),
                role: "read".into(),
                kind: "collect".into(),
                platform_id: p.id.clone(),
                code: p.code.clone(),
                label: format!("{} · 采集", p.name),
                version: p.collect_script_version,
                match_url: String::new(),
            });
        }
        if p.has_script {
            items.push(AgentChannelScript {
                key: script_key("publish", &p.id),
                role: "act".into(),
                kind: "publish".into(),
                platform_id: p.id.clone(),
                code: p.code.clone(),
                label: format!("{} · 填表", p.name),
                version: p.script_version,
                match_url: String::new(),
            });
        }
    }
    items
}

/// 解析某代理已绑定且仍有效的渠道脚本（含 match_url）。
pub async fn list_bound_scripts(app: &AppHandle, agent_id: &str) -> Result<Vec<AgentChannelScript>, String> {
    let agent = find_by_slug_or_id(app, agent_id)
        .await
        .ok_or_else(|| "代理不存在".to_string())?;
    if !agent.enabled {
        return Err("代理未启用".into());
    }
    Ok(resolve_bound_scripts(app, &agent.scripts))
}

pub fn resolve_bound_scripts(app: &AppHandle, keys: &[String]) -> Vec<AgentChannelScript> {
    if keys.is_empty() {
        return vec![];
    }
    let packages = medias::packages::list_published_for_bridge(app);
    let platforms = medias::bridge_list_platforms(app);
    let mut out = Vec::new();
    for key in keys {
        let Some((kind, id)) = parse_script_key(key) else {
            continue;
        };
        if kind == "script"
            || packages.iter().any(|p| p.id == id || p.code == id)
        {
            let Some(p) = packages.iter().find(|p| p.id == id || p.code == id) else {
                continue;
            };
            out.push(AgentChannelScript {
                key: script_key("script", &p.id),
                role: "read".into(),
                kind: "script".into(),
                platform_id: p.id.clone(),
                code: p.code.clone(),
                label: p.name.clone(),
                version: p.published_version,
                match_url: String::new(),
            });
            continue;
        }
        let Some(p) = platforms
            .iter()
            .find(|p| p.id == id || p.code == id)
        else {
            continue;
        };
        let (ok, version, role) = if kind == "collect" {
            (p.has_collect_script, p.collect_script_version, "read")
        } else {
            (p.has_script, p.script_version, "act")
        };
        if !ok {
            continue;
        }
        let match_url = if kind == "collect" {
            medias::bridge_get_collect_script(app, &p.code)
        } else {
            medias::bridge_get_script(app, &p.code)
        }
        .map(|s| s.match_url)
        .unwrap_or_default();
        out.push(AgentChannelScript {
            key: script_key(&kind, &p.id),
            role: role.into(),
            kind: kind.clone(),
            platform_id: p.id.clone(),
            code: p.code.clone(),
            label: if kind == "collect" {
                format!("{} · 采集", p.name)
            } else {
                format!("{} · 填表", p.name)
            },
            version,
            match_url,
        });
    }
    out
}

pub async fn add(
    app: &AppHandle,
    slug: String,
    name: String,
    remark: String,
    system_prompt: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    scripts: Option<Vec<String>>,
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
        scripts: normalize_scripts(scripts),
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
    scripts: Option<Vec<String>>,
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
    if let Some(s) = scripts {
        profile.scripts = normalize_scripts(Some(s));
    }
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
