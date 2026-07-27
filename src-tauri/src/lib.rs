mod agent;
mod accounts;
mod agents;
mod channels;
mod config;
mod images;
mod knowledge;
mod mcp;
mod memory;
mod persist;
mod provider;
mod schedules;
mod skills;
mod tools;
mod videos;

use agent::AgentState;
use channels::TelegramConfig;
use config::{AppConfig, ProviderConfig, ProviderKind, ProviderProfile, ProviderProfileInfo};
use knowledge::KnowledgeEntry;
use mcp::{McpManager, McpServerConfig, McpServerInfo};
use memory::Session;
use serde_json::json;
use tauri::{Manager, State};

// ── Chat ──────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn chat_send(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    session_id: Option<String>,
    content: String,
) -> Result<String, String> {
    agent::send_message(app, state, session_id, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn session_list(state: State<'_, AgentState>) -> Vec<serde_json::Value> {
    let sessions = state.sessions.lock().unwrap();
    let mut list: Vec<Session> = sessions.values().cloned().collect();
    list.sort_by(|a, b| match (a.pinned, b.pinned) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.updated_at.cmp(&a.updated_at),
    });
    list.iter()
        .map(|s| {
            json!({
                "id": s.id,
                "title": s.title,
                "updated_at": s.updated_at,
                "message_count": s.messages.len(),
                "pinned": s.pinned,
            })
        })
        .collect()
}

#[tauri::command]
fn session_get(state: State<'_, AgentState>, session_id: String) -> Option<Session> {
    state.sessions.lock().unwrap().get(&session_id).cloned()
}

#[tauri::command]
fn session_delete(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if sessions.remove(&session_id).is_none() {
        return Err("会话不存在".into());
    }
    persist::save_sessions(&app, &sessions);
    Ok(())
}

#[tauri::command]
fn session_rename(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    let trimmed = title.trim().to_string();
    if trimmed.is_empty() {
        return Err("标题不能为空".into());
    }
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "会话不存在".to_string())?;
    session.title = trimmed;
    session.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    persist::save_sessions(&app, &sessions);
    Ok(())
}

#[tauri::command]
fn session_pin(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    session_id: String,
    pinned: bool,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "会话不存在".to_string())?;
    session.pinned = pinned;
    persist::save_sessions(&app, &sessions);
    Ok(())
}

// ── Config ────────────────────────────────────────────────────────────────────

#[tauri::command]
fn config_get(state: State<'_, AgentState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn config_set(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    api_key: String,
    model: String,
    provider: String,
    base_url: Option<String>,
) -> Result<(), String> {
    let kind = match provider.as_str() {
        "openai" => ProviderKind::OpenAI,
        _ => ProviderKind::Anthropic,
    };
    let mut cfg = state.config.lock().unwrap();
    cfg.provider = ProviderConfig {
        kind,
        api_key,
        model,
        base_url,
    };
    cfg.ensure_profiles();
    cfg.upsert_active_from_provider();
    persist::save_config(&app, &cfg);
    Ok(())
}

fn parse_provider_kind(provider: &str) -> ProviderKind {
    match provider {
        "openai" => ProviderKind::OpenAI,
        _ => ProviderKind::Anthropic,
    }
}

#[tauri::command]
fn provider_list(state: State<'_, AgentState>) -> Vec<ProviderProfileInfo> {
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    cfg.profile_infos()
}

#[tauri::command]
fn provider_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> Result<ProviderProfileInfo, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    if model.trim().is_empty() {
        return Err("模型 ID 不能为空".into());
    }

    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if cfg.profiles.iter().any(|p| p.name == name) {
        return Err(format!("已存在同名配置「{name}」"));
    }

    let profile = ProviderProfile {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        kind: parse_provider_kind(&provider),
        api_key,
        model: model.trim().to_string(),
        base_url: base_url.filter(|s| !s.trim().is_empty()),
    };
    let id = profile.id.clone();
    cfg.profiles.push(profile);
    if cfg.active_profile_id.is_none() {
        cfg.active_profile_id = Some(id.clone());
        cfg.sync_active_provider();
    }
    persist::save_config(&app, &cfg);
    cfg.profile_infos()
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "添加失败".into())
}

#[tauri::command]
fn provider_update(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
    name: String,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> Result<ProviderProfileInfo, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    if model.trim().is_empty() {
        return Err("模型 ID 不能为空".into());
    }

    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if cfg
        .profiles
        .iter()
        .any(|p| p.name == name && p.id != id)
    {
        return Err(format!("已存在同名配置「{name}」"));
    }

    let profile = cfg
        .profiles
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "配置不存在".to_string())?;
    profile.name = name;
    profile.kind = parse_provider_kind(&provider);
    profile.api_key = api_key;
    profile.model = model.trim().to_string();
    profile.base_url = base_url.filter(|s| !s.trim().is_empty());

    if cfg.active_profile_id.as_deref() == Some(id.as_str()) {
        cfg.sync_active_provider();
    }
    persist::save_config(&app, &cfg);
    cfg.profile_infos()
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "更新失败".into())
}

#[tauri::command]
fn provider_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if cfg.profiles.len() <= 1 {
        return Err("至少保留一条模型配置".into());
    }
    if !cfg.profiles.iter().any(|p| p.id == id) {
        return Err("配置不存在".into());
    }
    cfg.profiles.retain(|p| p.id != id);
    if cfg.active_profile_id.as_deref() == Some(id.as_str()) {
        cfg.active_profile_id = cfg.profiles.first().map(|p| p.id.clone());
        cfg.sync_active_provider();
    }
    persist::save_config(&app, &cfg);
    Ok(())
}

#[tauri::command]
fn provider_activate(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<ProviderProfileInfo, String> {
    let mut cfg = state.config.lock().unwrap();
    cfg.ensure_profiles();
    if !cfg.profiles.iter().any(|p| p.id == id) {
        return Err("配置不存在".into());
    }
    cfg.active_profile_id = Some(id.clone());
    cfg.sync_active_provider();
    persist::save_config(&app, &cfg);
    cfg.profile_infos()
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "激活失败".into())
}

#[tauri::command]
fn permission_respond(state: State<'_, AgentState>, request_id: String, allowed: bool) {
    agent::resolve_permission(&state, &request_id, allowed);
}

// ── MCP ───────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn mcp_list(state: State<'_, AgentState>) -> Result<Vec<McpServerInfo>, String> {
    Ok(state.mcp.lock().await.server_infos())
}

#[tauri::command]
async fn mcp_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
    command: String,
    args: Vec<String>,
    env: std::collections::HashMap<String, String>,
    cwd: Option<String>,
    description: String,
    enabled: bool,
) -> Result<McpServerInfo, String> {
    let config = McpServerConfig {
        command,
        args,
        env,
        cwd: cwd.filter(|s| !s.trim().is_empty()),
        description,
        enabled,
    };
    let mut mcp = state.mcp.lock().await;
    mcp.add_server(name.clone(), config).await?;
    persist::save_mcp_configs(&app, &mcp.configs);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| "添加失败".into())
}

#[tauri::command]
async fn mcp_update(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
    command: String,
    args: Vec<String>,
    env: std::collections::HashMap<String, String>,
    cwd: Option<String>,
    description: String,
    enabled: bool,
) -> Result<McpServerInfo, String> {
    let config = McpServerConfig {
        command,
        args,
        env,
        cwd: cwd.filter(|s| !s.trim().is_empty()),
        description,
        enabled,
    };
    let mut mcp = state.mcp.lock().await;
    mcp.update_server(&name, config).await?;
    persist::save_mcp_configs(&app, &mcp.configs);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| "更新失败".into())
}

#[tauri::command]
async fn mcp_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
) -> Result<(), String> {
    let mut mcp = state.mcp.lock().await;
    mcp.remove_server(&name);
    persist::save_mcp_configs(&app, &mcp.configs);
    Ok(())
}

#[tauri::command]
async fn mcp_reconnect(
    state: State<'_, AgentState>,
    name: String,
) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.reconnect(&name).await;
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Server {name} not found"))
}

#[tauri::command]
async fn mcp_disconnect(
    state: State<'_, AgentState>,
    name: String,
) -> Result<McpServerInfo, String> {
    let mut mcp = state.mcp.lock().await;
    mcp.disconnect(&name);
    mcp.server_infos()
        .into_iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Server {name} not found"))
}

#[tauri::command]
async fn mcp_tools(
    state: State<'_, AgentState>,
    name: String,
) -> Result<Vec<mcp::McpToolDef>, String> {
    Ok(state.mcp.lock().await.tools_for(&name))
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn knowledge_list(state: State<'_, AgentState>) -> Vec<KnowledgeEntry> {
    state.knowledge.lock().unwrap().clone()
}

#[tauri::command]
fn knowledge_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    title: String,
    description: String,
    content: String,
    tags: Vec<String>,
) -> Result<KnowledgeEntry, String> {
    let entry = KnowledgeEntry::new(title, description, content, tags);
    let mut entries = state.knowledge.lock().unwrap();
    entries.push(entry.clone());
    persist::save_knowledge(&app, &entries);
    Ok(entry)
}

#[tauri::command]
fn knowledge_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    let mut entries = state.knowledge.lock().unwrap();
    entries.retain(|e| e.id != id);
    persist::save_knowledge(&app, &entries);
    Ok(())
}

// ── Channels ──────────────────────────────────────────────────────────────────

#[tauri::command]
async fn channel_telegram_get(state: State<'_, AgentState>) -> Result<serde_json::Value, String> {
    let ch = state.channel.lock().await;
    let running = ch.is_telegram_running();
    let token = ch
        .config
        .telegram
        .as_ref()
        .map(|t| t.token.clone())
        .unwrap_or_default();
    let allowed_ids = ch
        .config
        .telegram
        .as_ref()
        .map(|t| t.allowed_ids.clone())
        .unwrap_or_default();
    Ok(json!({ "token": token, "allowed_ids": allowed_ids, "running": running }))
}

#[tauri::command]
async fn channel_telegram_set(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    token: String,
    allowed_ids: Vec<String>,
) -> Result<(), String> {
    let cfg = TelegramConfig { token, allowed_ids };
    let mut ch = state.channel.lock().await;
    ch.config.telegram = Some(cfg);
    persist::save_channel_config(&app, &ch.config);
    Ok(())
}

#[tauri::command]
async fn channel_telegram_start(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    // 每次启动都先停旧 poller，避免热重载/重复点击导致 getUpdates Conflict
    channels::restart_telegram_poller(&mut ch, app).await
}

#[tauri::command]
async fn channel_telegram_stop(state: State<'_, AgentState>) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    channels::stop_telegram_poller(&mut ch).await;
    Ok(())
}

// ── Images ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn image_generate(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    prompt: String,
    model: String,
    size: String,
) -> Result<images::GeneratedImage, String> {
    let config = state.config.lock().unwrap().clone();
    images::generate(&app, config, prompt, model, size)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn image_list(app: tauri::AppHandle) -> Vec<images::GeneratedImage> {
    images::list(&app)
}

#[tauri::command]
fn image_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    images::delete(&app, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn image_data_url(path: String) -> Result<String, String> {
    images::read_data_url(path).map_err(|e| e.to_string())
}

// ── Videos ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn video_generate(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    prompt: String,
    model: String,
    size: String,
    seconds: String,
) -> Result<videos::GeneratedVideo, String> {
    let config = state.config.lock().unwrap().clone();
    videos::generate(&app, config, prompt, model, size, seconds)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn video_list(app: tauri::AppHandle) -> Vec<videos::GeneratedVideo> {
    videos::list(&app)
}

#[tauri::command]
fn video_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    videos::delete(&app, id).map_err(|e| e.to_string())
}

// ── Platform accounts ─────────────────────────────────────────────────────────

#[tauri::command]
fn account_list(app: tauri::AppHandle) -> Vec<accounts::PlatformAccount> {
    accounts::list(&app)
}

#[tauri::command]
fn account_add(
    app: tauri::AppHandle,
    name: String,
    platform: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
) -> Result<accounts::PlatformAccount, String> {
    accounts::add(
        &app,
        name,
        platform,
        account_id,
        access_key,
        secret_key,
        enabled,
        notes,
    )
}

#[tauri::command]
fn account_update(
    app: tauri::AppHandle,
    id: String,
    name: String,
    platform: String,
    account_id: String,
    access_key: String,
    secret_key: String,
    enabled: bool,
    notes: String,
) -> Result<accounts::PlatformAccount, String> {
    accounts::update(
        &app,
        id,
        name,
        platform,
        account_id,
        access_key,
        secret_key,
        enabled,
        notes,
    )
}

#[tauri::command]
fn account_remove(app: tauri::AppHandle, id: String) -> Result<(), String> {
    accounts::remove(&app, id)
}

// ── Schedule projects / workflows ─────────────────────────────────────────────

#[tauri::command]
fn schedule_list(app: tauri::AppHandle) -> Vec<schedules::ScheduleProject> {
    schedules::list(&app)
}

#[tauri::command]
fn schedule_get(app: tauri::AppHandle, id: String) -> Result<schedules::ScheduleProject, String> {
    schedules::get(&app, &id)
}

#[tauri::command]
fn schedule_add(
    app: tauri::AppHandle,
    name: String,
    description: String,
    enabled: bool,
) -> Result<schedules::ScheduleProject, String> {
    schedules::add(&app, name, description, enabled)
}

#[tauri::command]
fn schedule_update(
    app: tauri::AppHandle,
    id: String,
    name: String,
    description: String,
    enabled: bool,
) -> Result<schedules::ScheduleProject, String> {
    schedules::update_meta(&app, id, name, description, enabled)
}

#[tauri::command]
fn schedule_save_workflow(
    app: tauri::AppHandle,
    id: String,
    workflow: schedules::WorkflowGraph,
) -> Result<schedules::ScheduleProject, String> {
    schedules::save_workflow(&app, id, workflow)
}

#[tauri::command]
fn schedule_remove(app: tauri::AppHandle, id: String) -> Result<(), String> {
    schedules::remove(&app, id)
}

// ── Skills (OpenClaw SKILL.md) ─────────────────────────────────────────────────

fn sync_skills_state(app: &tauri::AppHandle, state: &State<'_, AgentState>) {
    let list = skills::list(app);
    *state.skills.lock().unwrap() = list;
}

#[tauri::command]
fn skill_list(app: tauri::AppHandle, state: State<'_, AgentState>) -> Vec<skills::Skill> {
    let list = skills::list(&app);
    *state.skills.lock().unwrap() = list.clone();
    list
}

#[tauri::command]
fn skill_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<skills::Skill, String> {
    let skill = skills::add(
        &app,
        name,
        description,
        body,
        enabled,
        user_invocable,
        disable_model_invocation,
        homepage,
        metadata,
    )?;
    sync_skills_state(&app, &state);
    Ok(skill)
}

#[tauri::command]
fn skill_update(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<skills::Skill, String> {
    let skill = skills::update(
        &app,
        id,
        name,
        description,
        body,
        enabled,
        user_invocable,
        disable_model_invocation,
        homepage,
        metadata,
    )?;
    sync_skills_state(&app, &state);
    Ok(skill)
}

#[tauri::command]
fn skill_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    skills::remove(&app, id)?;
    sync_skills_state(&app, &state);
    Ok(())
}

#[tauri::command]
fn skill_export_md(app: tauri::AppHandle, id: String) -> Result<String, String> {
    let skill = skills::list(&app)
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| "技能不存在".to_string())?;
    Ok(skills::to_skill_md(&skill))
}

// ── Agent profiles ────────────────────────────────────────────────────────────

fn sync_agents_state(app: &tauri::AppHandle, state: &State<'_, AgentState>) {
    *state.agents.lock().unwrap() = agents::list(app);
}

#[tauri::command]
fn agent_list(app: tauri::AppHandle, state: State<'_, AgentState>) -> Vec<agents::AgentProfile> {
    let list = agents::list(&app);
    *state.agents.lock().unwrap() = list.clone();
    list
}

#[tauri::command]
fn agent_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    slug: String,
    name: String,
    description: String,
    system_prompt: String,
    emoji: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    allow_as_subagent: bool,
) -> Result<agents::AgentProfile, String> {
    let profile = agents::add(
        &app,
        slug,
        name,
        description,
        system_prompt,
        emoji,
        enabled,
        skills,
        allow_as_subagent,
    )?;
    sync_agents_state(&app, &state);
    Ok(profile)
}

#[tauri::command]
fn agent_update(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
    slug: String,
    name: String,
    description: String,
    system_prompt: String,
    emoji: String,
    enabled: bool,
    skills: Option<Vec<String>>,
    allow_as_subagent: bool,
) -> Result<agents::AgentProfile, String> {
    let profile = agents::update(
        &app,
        id,
        slug,
        name,
        description,
        system_prompt,
        emoji,
        enabled,
        skills,
        allow_as_subagent,
    )?;
    sync_agents_state(&app, &state);
    Ok(profile)
}

#[tauri::command]
fn agent_activate(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<agents::AgentProfile, String> {
    let profile = agents::activate(&app, id)?;
    sync_agents_state(&app, &state);
    Ok(profile)
}

#[tauri::command]
fn agent_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    agents::remove(&app, id)?;
    sync_agents_state(&app, &state);
    Ok(())
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AgentState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<AgentState>();

            if let Some(mut config) = persist::load_config(&handle) {
                config.ensure_profiles();
                persist::save_config(&handle, &config);
                *state.config.lock().unwrap() = config;
            }
            *state.sessions.lock().unwrap() = persist::load_sessions(&handle);
            *state.knowledge.lock().unwrap() = persist::load_knowledge(&handle);
            *state.skills.lock().unwrap() = skills::ensure_seeded(&handle);
            *state.agents.lock().unwrap() = agents::ensure_seeded(&handle);

            // MCP
            let mcp_configs = persist::load_mcp_configs(&handle);
            if !mcp_configs.is_empty() {
                let h2 = handle.clone();
                tauri::async_runtime::spawn(async move {
                    let s = h2.state::<AgentState>();
                    let mut mcp = s.mcp.lock().await;
                    mcp.configs = mcp_configs;
                    mcp.connect_all().await;
                });
            }

            // Channels
            let channel_cfg = persist::load_channel_config(&handle);
            let h3 = handle.clone();
            tauri::async_runtime::spawn(async move {
                let s = h3.state::<AgentState>();
                let mut ch = s.channel.lock().await;
                ch.config = channel_cfg;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat_send,
            session_list,
            session_get,
            session_delete,
            session_rename,
            session_pin,
            config_get,
            config_set,
            provider_list,
            provider_add,
            provider_update,
            provider_remove,
            provider_activate,
            permission_respond,
            mcp_list,
            mcp_add,
            mcp_update,
            mcp_remove,
            mcp_reconnect,
            mcp_disconnect,
            mcp_tools,
            knowledge_list,
            knowledge_add,
            knowledge_remove,
            channel_telegram_get,
            channel_telegram_set,
            channel_telegram_start,
            channel_telegram_stop,
            image_generate,
            image_list,
            image_delete,
            image_data_url,
            video_generate,
            video_list,
            video_delete,
            account_list,
            account_add,
            account_update,
            account_remove,
            schedule_list,
            schedule_get,
            schedule_add,
            schedule_update,
            schedule_save_workflow,
            schedule_remove,
            skill_list,
            skill_add,
            skill_update,
            skill_remove,
            skill_export_md,
            agent_list,
            agent_add,
            agent_update,
            agent_activate,
            agent_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
