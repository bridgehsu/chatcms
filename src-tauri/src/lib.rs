mod agent;
mod accounts;
mod agents;
mod channels;
mod chat_bridge;
mod config;
mod images;
mod knowledge;
mod mcp;
mod media_platforms;
mod memory;
mod permission;
mod persist;
mod provider;
mod publish;
mod schedules;
mod skills;
mod tools;
mod videos;

use agent::AgentState;
use config::{AppConfig, ProviderConfig, ProviderKind, ProviderProfile, ProviderProfileInfo};
use knowledge::KnowledgeEntry;
use mcp::{McpManager, McpServerConfig, McpServerInfo};
use memory::Session;
use publish::PublishBridge;
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
fn permission_respond(
    state: State<'_, AgentState>,
    request_id: String,
    allowed: bool,
    remember: Option<String>,
) {
    let remember = match remember.as_deref() {
        Some("session_allow") => permission::RememberScope::SessionAllow,
        Some("session_deny") => permission::RememberScope::SessionDeny,
        _ => permission::RememberScope::Once,
    };
    agent::resolve_permission(&state, &request_id, allowed, remember);
}

#[tauri::command]
fn permission_get(state: State<'_, AgentState>) -> permission::PermissionConfig {
    let mut cfg = state.config.lock().unwrap().permission.clone();
    cfg.ensure_defaults();
    cfg
}

#[tauri::command]
fn permission_set(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    config: permission::PermissionConfig,
) -> Result<(), String> {
    let mut cfg = config;
    cfg.ensure_defaults();
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission = cfg;
    persist::save_config(&app, &app_cfg);
    Ok(())
}

#[tauri::command]
fn permission_mode_list(state: State<'_, AgentState>) -> Vec<permission::PermissionMode> {
    let mut cfg = state.config.lock().unwrap().permission.clone();
    cfg.ensure_defaults();
    permission::list_modes(&cfg)
}

#[tauri::command]
fn permission_mode_add(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    name: String,
    description: String,
    domains: Option<std::collections::HashMap<String, permission::DomainPolicy>>,
) -> Result<permission::PermissionMode, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    let mode = permission::add_mode(
        &mut app_cfg.permission,
        name,
        description,
        domains,
    )?;
    persist::save_config(&app, &app_cfg);
    Ok(mode)
}

#[tauri::command]
fn permission_mode_update(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
    name: String,
    description: String,
    domains: std::collections::HashMap<String, permission::DomainPolicy>,
) -> Result<permission::PermissionMode, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    let mode = permission::update_mode(
        &mut app_cfg.permission,
        &id,
        name,
        description,
        domains,
    )?;
    persist::save_config(&app, &app_cfg);
    Ok(mode)
}

#[tauri::command]
fn permission_mode_remove(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    permission::remove_mode(&mut app_cfg.permission, &id)?;
    persist::save_config(&app, &app_cfg);
    Ok(())
}

#[tauri::command]
fn permission_mode_reorder(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    ordered_ids: Vec<String>,
) -> Result<Vec<permission::PermissionMode>, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    permission::reorder_modes(&mut app_cfg.permission, ordered_ids)?;
    let list = permission::list_modes(&app_cfg.permission);
    persist::save_config(&app, &app_cfg);
    Ok(list)
}

#[tauri::command]
fn permission_mode_set_active(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<permission::PermissionMode, String> {
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    let mode = permission::set_active_mode(&mut app_cfg.permission, &id)?;
    persist::save_config(&app, &app_cfg);
    Ok(mode)
}

#[tauri::command]
fn permission_domains(state: State<'_, AgentState>) -> Vec<permission::DomainInfo> {
    let mut cfg = state.config.lock().unwrap().permission.clone();
    cfg.ensure_defaults();
    permission::Domain::all()
        .iter()
        .map(|d| permission::DomainInfo {
            id: d.as_str().to_string(),
            label: d.label().to_string(),
            policy: cfg.domain_policy(*d),
        })
        .collect()
}

#[tauri::command]
fn permission_audit_list(app: tauri::AppHandle, limit: Option<usize>) -> Vec<permission::AuditEvent> {
    permission::list_audit(&app, limit.unwrap_or(100))
}

#[tauri::command]
fn permission_clear_session_grants(state: State<'_, AgentState>, session_id: String) {
    state.session_grants.lock().unwrap().clear_session(&session_id);
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
fn knowledge_update(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    id: String,
    title: String,
    description: String,
    content: String,
    tags: Vec<String>,
) -> Result<KnowledgeEntry, String> {
    let title = title.trim().to_string();
    let content = content.trim().to_string();
    if title.is_empty() {
        return Err("标题不能为空".into());
    }
    if content.is_empty() {
        return Err("内容不能为空".into());
    }
    let mut entries = state.knowledge.lock().unwrap();
    let entry = entries
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| "条目不存在".to_string())?;
    entry.title = title;
    entry.description = description.trim().to_string();
    entry.content = content;
    entry.tags = tags;
    let out = entry.clone();
    persist::save_knowledge(&app, &entries);
    Ok(out)
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
async fn channel_list(state: State<'_, AgentState>) -> Result<Vec<channels::ChannelInfo>, String> {
    let ch = state.channel.lock().await;
    Ok(ch.list_infos())
}

#[tauri::command]
async fn channel_get(
    state: State<'_, AgentState>,
    kind: String,
) -> Result<serde_json::Value, String> {
    let ch = state.channel.lock().await;
    match kind.as_str() {
        "telegram" => {
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
            Ok(json!({
                "kind": "telegram",
                "token": token,
                "allowed_ids": allowed_ids,
                "enabled": ch.config.is_kind_enabled("telegram")
                    && ch.is_telegram_running(),
            }))
        }
        other => {
            let draft = ch
                .config
                .drafts
                .get(other)
                .cloned()
                .unwrap_or_default();
            Ok(json!({
                "kind": other,
                "token": draft.token,
                "webhook": draft.webhook,
                "notes": draft.notes,
                "extra": draft.extra,
                "enabled": false,
            }))
        }
    }
}

#[tauri::command]
async fn channel_update(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    kind: String,
    token: String,
    allowed_ids: Option<Vec<String>>,
    webhook: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    match kind.as_str() {
        "telegram" => {
            ch.config.telegram = Some(channels::TelegramConfig {
                token,
                allowed_ids: allowed_ids.unwrap_or_default(),
            });
        }
        other => {
            if !channels::known_kinds().iter().any(|(k, _, _, _)| *k == other) {
                return Err(format!("未知渠道: {other}"));
            }
            let entry = ch.config.drafts.entry(other.to_string()).or_default();
            entry.token = token;
            if let Some(w) = webhook {
                entry.webhook = w;
            }
            if let Some(n) = notes {
                entry.notes = n;
            }
        }
    }
    persist::save_channel_config(&app, &ch.config);
    Ok(())
}

#[tauri::command]
async fn channel_enable(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    kind: String,
) -> Result<Vec<channels::ChannelInfo>, String> {
    let mut ch = state.channel.lock().await;
    channels::enable_kind(&mut ch, app.clone(), &kind).await?;
    persist::save_channel_config(&app, &ch.config);
    Ok(ch.list_infos())
}

#[tauri::command]
async fn channel_disable(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    kind: String,
) -> Result<Vec<channels::ChannelInfo>, String> {
    let mut ch = state.channel.lock().await;
    channels::disable_kind(&mut ch, &kind).await?;
    persist::save_channel_config(&app, &ch.config);
    Ok(ch.list_infos())
}

#[tauri::command]
async fn channel_telegram_get(state: State<'_, AgentState>) -> Result<serde_json::Value, String> {
    channel_get(state, "telegram".into()).await
}

#[tauri::command]
async fn channel_telegram_set(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
    token: String,
    allowed_ids: Vec<String>,
) -> Result<(), String> {
    channel_update(
        app,
        state,
        "telegram".into(),
        token,
        Some(allowed_ids),
        None,
        None,
    )
    .await
}

#[tauri::command]
async fn channel_telegram_start(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    channels::enable_kind(&mut ch, app.clone(), "telegram").await?;
    persist::save_channel_config(&app, &ch.config);
    Ok(())
}

#[tauri::command]
async fn channel_telegram_stop(
    app: tauri::AppHandle,
    state: State<'_, AgentState>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    channels::disable_kind(&mut ch, "telegram").await?;
    persist::save_channel_config(&app, &ch.config);
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
fn image_upload(
    app: tauri::AppHandle,
    data_base64: String,
    filename: String,
    content_type: Option<String>,
) -> Result<images::GeneratedImage, String> {
    images::upload_base64(
        &app,
        &data_base64,
        &filename,
        content_type.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn image_update(
    app: tauri::AppHandle,
    id: String,
    title: String,
    note: String,
) -> Result<images::GeneratedImage, String> {
    images::update(&app, id, title, note).map_err(|e| e.to_string())
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

#[tauri::command]
fn video_upload(
    app: tauri::AppHandle,
    data_base64: String,
    filename: String,
    content_type: Option<String>,
) -> Result<videos::GeneratedVideo, String> {
    videos::upload_base64(
        &app,
        &data_base64,
        &filename,
        content_type.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn video_update(
    app: tauri::AppHandle,
    id: String,
    title: String,
    note: String,
) -> Result<videos::GeneratedVideo, String> {
    videos::update(&app, id, title, note).map_err(|e| e.to_string())
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

// ── Media platforms / publish scripts ─────────────────────────────────────────

#[tauri::command]
fn media_platform_list(app: tauri::AppHandle) -> Vec<media_platforms::MediaPlatform> {
    media_platforms::list_platforms(&app)
}

#[tauri::command]
fn media_platform_list_page(
    app: tauri::AppHandle,
    query: Option<String>,
    kind: Option<String>,
    page: u32,
    page_size: u32,
) -> media_platforms::MediaPlatformPage {
    media_platforms::list_platforms_page(&app, query, kind, page, page_size)
}

#[tauri::command]
fn media_platform_get(
    app: tauri::AppHandle,
    id: String,
) -> Result<media_platforms::MediaPlatform, String> {
    media_platforms::get_platform(&app, &id).ok_or_else(|| "平台不存在".into())
}

#[tauri::command]
fn media_platform_upsert(
    app: tauri::AppHandle,
    id: Option<String>,
    code: String,
    name: String,
    kind: String,
    inject_url: String,
    home_url: String,
    enabled: bool,
    notes: String,
) -> Result<media_platforms::MediaPlatform, String> {
    media_platforms::upsert_platform(
        &app,
        id,
        code,
        name,
        kind,
        inject_url,
        home_url,
        enabled,
        notes,
    )
}

#[tauri::command]
fn media_platform_set_enabled(
    app: tauri::AppHandle,
    id: String,
    enabled: bool,
) -> Result<media_platforms::MediaPlatform, String> {
    media_platforms::set_platform_enabled(&app, id, enabled)
}

#[tauri::command]
fn media_platform_remove(app: tauri::AppHandle, id: String) -> Result<(), String> {
    media_platforms::remove_platform(&app, id)
}

#[tauri::command]
fn publish_script_get(
    app: tauri::AppHandle,
    platform_id: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::get_or_create_script(&app, platform_id)
}

#[tauri::command]
fn publish_script_list(
    app: tauri::AppHandle,
    platform_id: Option<String>,
) -> Vec<media_platforms::PublishScriptView> {
    media_platforms::list_scripts(&app, platform_id)
}

#[tauri::command]
fn publish_script_save_draft(
    app: tauri::AppHandle,
    platform_id: String,
    draft_script: String,
    match_url: String,
    changelog: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::save_script_draft(&app, platform_id, draft_script, match_url, changelog)
}

#[tauri::command]
fn publish_script_publish(
    app: tauri::AppHandle,
    platform_id: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::publish_script(&app, platform_id)
}

#[tauri::command]
fn publish_script_discard_draft(
    app: tauri::AppHandle,
    platform_id: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::discard_script_draft(&app, platform_id)
}

#[tauri::command]
fn collect_script_get(
    app: tauri::AppHandle,
    platform_id: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::get_or_create_collect_script(&app, platform_id)
}

#[tauri::command]
fn collect_script_list(
    app: tauri::AppHandle,
    platform_id: Option<String>,
) -> Vec<media_platforms::PublishScriptView> {
    media_platforms::list_collect_scripts(&app, platform_id)
}

#[tauri::command]
fn collect_script_save_draft(
    app: tauri::AppHandle,
    platform_id: String,
    draft_script: String,
    match_url: String,
    changelog: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::save_collect_script_draft(
        &app,
        platform_id,
        draft_script,
        match_url,
        changelog,
    )
}

#[tauri::command]
fn collect_script_publish(
    app: tauri::AppHandle,
    platform_id: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::publish_collect_script(&app, platform_id)
}

#[tauri::command]
fn collect_script_discard_draft(
    app: tauri::AppHandle,
    platform_id: String,
) -> Result<media_platforms::PublishScriptView, String> {
    media_platforms::discard_collect_script_draft(&app, platform_id)
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
    permission_overrides: Option<std::collections::HashMap<String, permission::DomainPolicy>>,
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
        permission_overrides.unwrap_or_default(),
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
    permission_overrides: Option<std::collections::HashMap<String, permission::DomainPolicy>>,
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
        permission_overrides.unwrap_or_default(),
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

// ── Publish bridge（浏览器插件自动填表）──────────────────────────────────────

#[tauri::command]
async fn publish_to_browser(
    app: tauri::AppHandle,
    bridge: State<'_, PublishBridge>,
    sync_data: serde_json::Value,
) -> Result<String, String> {
    publish::prepare_and_open(&bridge, &app, sync_data).await
}

#[tauri::command]
fn publish_media_base() -> String {
    publish::PublishBridge::base_url()
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AgentState::new())
        .manage(PublishBridge::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<AgentState>();
            handle.state::<PublishBridge>().bind_app(handle.clone());
            let bridge = (*app.state::<PublishBridge>()).clone();
            tauri::async_runtime::spawn(async move {
                let _ = bridge.ensure_running().await;
            });

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
            permission_get,
            permission_set,
            permission_mode_list,
            permission_mode_add,
            permission_mode_update,
            permission_mode_remove,
            permission_mode_reorder,
            permission_mode_set_active,
            permission_domains,
            permission_audit_list,
            permission_clear_session_grants,
            mcp_list,
            mcp_add,
            mcp_update,
            mcp_remove,
            mcp_reconnect,
            mcp_disconnect,
            mcp_tools,
            knowledge_list,
            knowledge_add,
            knowledge_update,
            knowledge_remove,
            channel_list,
            channel_get,
            channel_update,
            channel_enable,
            channel_disable,
            channel_telegram_get,
            channel_telegram_set,
            channel_telegram_start,
            channel_telegram_stop,
            image_generate,
            image_list,
            image_delete,
            image_upload,
            image_update,
            image_data_url,
            video_generate,
            video_list,
            video_delete,
            video_upload,
            video_update,
            account_list,
            account_add,
            account_update,
            account_remove,
            media_platform_list,
            media_platform_list_page,
            media_platform_get,
            media_platform_upsert,
            media_platform_set_enabled,
            media_platform_remove,
            publish_script_get,
            publish_script_list,
            publish_script_save_draft,
            publish_script_publish,
            publish_script_discard_draft,
            collect_script_get,
            collect_script_list,
            collect_script_save_draft,
            collect_script_publish,
            collect_script_discard_draft,
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
            publish_to_browser,
            publish_media_base,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
