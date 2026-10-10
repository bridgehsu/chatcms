//! 浏览器扩展智能会话桥：page_key ↔ session，转发 chat_send，SSE 推送 stream-chunk。
//! 挂载在发布桥同一端口 `127.0.0.1:17890` 的 `/chat/*`。

use std::convert::Infallible;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{Emitter, Listener, Manager};
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::agents::AgentState;
use crate::core::run as send_message;
use crate::chat::Session;
use crate::common::persist;
use crate::common::provider::StreamChunk;
use crate::publish::PublishBridge;

#[derive(Debug, Deserialize)]
pub struct SessionEnsureRequest {
    pub page_key: String,
    #[serde(default)]
    pub title: Option<String>,
    /// 新建会话时写入的分组（已有绑定会话忽略）
    #[serde(default)]
    pub group_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionEnsureResponse {
    pub session_id: String,
    pub created: bool,
}

#[derive(Debug, Deserialize)]
pub struct ChatSendRequest {
    pub content: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub page_key: Option<String>,
    /// 为 true 时忽略 page_key 已有绑定，新建会话（对齐桌面「发起新会话」）
    #[serde(default)]
    pub force_new: bool,
    /// Ask / Agent / Search（对齐桌面 chat_mode；缺省 ask）
    #[serde(default)]
    pub chat_mode: Option<String>,
    /// 本轮首选代理（对齐桌面 chat_send agent_id；会话未绑定时生效）
    #[serde(default)]
    pub agent_id: Option<String>,
    /// 新建会话时写入的分组（已有 session_id 时忽略）
    #[serde(default)]
    pub group_id: Option<String>,
    /// 用户 @ 的脚本 / Skill / MCP
    #[serde(default)]
    pub attachments: Option<Vec<crate::chat::ChatAttachment>>,
}

#[derive(Debug, Serialize)]
struct AgentItem {
    id: String,
    slug: String,
    name: String,
    remark: String,
    enabled: bool,
    sort: i64,
}

#[derive(Debug, Deserialize)]
struct SetSessionAgentRequest {
    agent_id: String,
}

#[derive(Debug, Deserialize)]
struct SetSessionGroupRequest {
    /// null / 省略 / 空串 → 未分组
    #[serde(default)]
    group_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct SessionGroupItem {
    id: String,
    name: String,
    sort_order: i64,
}

#[derive(Debug, Deserialize)]
struct RenameSessionRequest {
    title: String,
}

#[derive(Debug, Deserialize)]
struct PinSessionRequest {
    pinned: bool,
}

#[derive(Debug, Deserialize)]
pub struct SessionResetRequest {
    pub page_key: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub group_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct PermissionModeItem {
    id: String,
    name: String,
    description: String,
    sort_order: i32,
}

#[derive(Debug, Serialize)]
struct PermissionModesResponse {
    modes: Vec<PermissionModeItem>,
    active_mode_id: String,
}

#[derive(Debug, Deserialize)]
struct SetActiveModeRequest {
    id: String,
}

#[derive(Debug, Serialize)]
struct ModelConfigResponse {
    kind: String,
    model: String,
    base_url: String,
    /// 不回传完整密钥，仅告知是否已配置
    has_api_key: bool,
}

#[derive(Debug, Deserialize)]
struct SetModelConfigRequest {
    provider: String,
    model: String,
    #[serde(default)]
    base_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct ModelProfileItem {
    id: String,
    name: String,
    model: String,
    tier: String,
    thinking: bool,
    enabled: bool,
}

#[derive(Debug, Serialize)]
struct ModelProfilesResponse {
    profiles: Vec<ModelProfileItem>,
    /// None / 空 = Auto 模式
    active_profile_id: Option<String>,
    auto_mode: bool,
}

#[derive(Debug, Deserialize)]
struct ActivateModelProfileRequest {
    /// None / 空字符串 / 省略 → Auto
    #[serde(default)]
    id: Option<String>,
}

/// 扩展路由，state 与发布桥共用 `PublishBridge`。
pub fn routes() -> Router<PublishBridge> {
    Router::new()
        .route("/chat/sessions", get(list_sessions))
        .route("/chat/session", post(ensure_session))
        .route("/chat/session/reset", post(reset_session))
        .route(
            "/chat/session/{id}",
            get(get_session).delete(delete_session),
        )
        .route("/chat/session/{id}/rename", post(rename_session))
        .route("/chat/session/{id}/pin", post(pin_session))
        .route("/chat/send", post(chat_send_sse))
        .route("/chat/permission-modes", get(list_permission_modes))
        .route(
            "/chat/permission-modes/active",
            post(set_active_permission_mode),
        )
        .route("/chat/model", get(get_model_config).post(set_model_config))
        .route(
            "/chat/model-profiles",
            get(list_model_profiles).post(activate_model_profile),
        )
        .route("/chat/agents", get(list_agents))
        .route("/chat/agents/{id}/scripts", get(list_agent_scripts))
        .route("/chat/skills", get(list_chat_skills))
        .route("/chat/mcp", get(list_chat_mcp))
        .route("/chat/script-jobs", get(list_script_jobs))
        .route("/chat/script-jobs/{id}/result", post(complete_script_job))
        .route("/chat/session-groups", get(list_session_groups))
        .route("/chat/session/{id}/agent", post(set_session_agent))
        .route("/chat/session/{id}/group", post(set_session_group))
}

fn normalize_group_id(raw: Option<String>) -> Option<String> {
    raw.map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

async fn resolve_group_id(app: &tauri::AppHandle, raw: Option<String>) -> Option<String> {
    let Some(gid) = normalize_group_id(raw) else {
        return None;
    };
    if crate::chat::repository::get_group(app, &gid).await.is_some() {
        Some(gid)
    } else {
        None
    }
}

fn normalize_page_key(raw: &str) -> String {
    let trimmed = raw.trim();
    let without_hash = trimmed.split_once('#').map(|(a, _)| a).unwrap_or(trimmed);
    let without_query = without_hash
        .split_once('?')
        .map(|(a, _)| a)
        .unwrap_or(without_hash);
    without_query.trim_end_matches('/').to_string()
}

fn bind_and_persist(bridge: &PublishBridge, page_key: &str, session_id: &str) {
    bridge.set_page_binding(page_key, session_id);
    if let Some(app) = bridge.app_handle() {
        let map = bridge.page_bindings_snapshot();
        persist::save_page_bindings(&app, &map);
        let _ = app.emit(
            "sessions-changed",
            json!({ "source": "extension", "session_id": session_id }),
        );
    }
}

async fn list_permission_modes(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let state = app.state::<AgentState>();
    let mut cfg = state.config.lock().unwrap().permission.clone();
    cfg.ensure_defaults();
    let modes = crate::common::permission::list_modes(&cfg)
        .into_iter()
        .map(|m| PermissionModeItem {
            id: m.id,
            name: m.name,
            description: m.description,
            sort_order: m.sort_order,
        })
        .collect();
    Json(PermissionModesResponse {
        modes,
        active_mode_id: cfg.active_mode_id,
    })
    .into_response()
}

async fn set_active_permission_mode(
    State(bridge): State<PublishBridge>,
    Json(body): Json<SetActiveModeRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let id = body.id.trim().to_string();
    if id.is_empty() {
        return (StatusCode::BAD_REQUEST, "id 不能为空").into_response();
    }

    let state = app.state::<AgentState>();
    let mut app_cfg = state.config.lock().unwrap();
    app_cfg.permission.ensure_defaults();
    match crate::common::permission::set_active_mode(&mut app_cfg.permission, &id) {
        Ok(mode) => {
            persist::save_config(&app, &app_cfg);
            Json(PermissionModeItem {
                id: mode.id,
                name: mode.name,
                description: mode.description,
                sort_order: mode.sort_order,
            })
            .into_response()
        }
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn get_model_config(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let cfg = app.state::<AgentState>().config.lock().unwrap().clone();
    let kind = match cfg.provider.kind {
        crate::common::config::ProviderKind::OpenAI => "openai",
        crate::common::config::ProviderKind::Anthropic => "anthropic",
    };
    Json(ModelConfigResponse {
        kind: kind.to_string(),
        model: cfg.provider.model,
        base_url: cfg.provider.base_url.unwrap_or_default(),
        has_api_key: !cfg.provider.api_key.trim().is_empty(),
    })
    .into_response()
}

async fn set_model_config(
    State(bridge): State<PublishBridge>,
    Json(body): Json<SetModelConfigRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let model = body.model.trim().to_string();
    if model.is_empty() {
        return (StatusCode::BAD_REQUEST, "model 不能为空").into_response();
    }
    let kind = match body.provider.trim() {
        "openai" => crate::common::config::ProviderKind::OpenAI,
        _ => crate::common::config::ProviderKind::Anthropic,
    };
    let base_url = body
        .base_url
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let state = app.state::<AgentState>();
    let mut cfg = state.config.lock().unwrap();
    // 保留已有 API Key，仅切换模型族/版本
    cfg.provider.kind = kind;
    cfg.provider.model = model;
    cfg.provider.base_url = base_url;
    cfg.ensure_profiles();
    cfg.upsert_active_from_provider();
    persist::save_config(&app, &cfg);

    let kind_str = match cfg.provider.kind {
        crate::common::config::ProviderKind::OpenAI => "openai",
        crate::common::config::ProviderKind::Anthropic => "anthropic",
    };
    Json(ModelConfigResponse {
        kind: kind_str.to_string(),
        model: cfg.provider.model.clone(),
        base_url: cfg.provider.base_url.clone().unwrap_or_default(),
        has_api_key: !cfg.provider.api_key.trim().is_empty(),
    })
    .into_response()
}

async fn list_agents(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let mut list = crate::agents::service::list(&app).await;
    list.retain(|a| a.enabled);
    list.sort_by(|a, b| a.sort.cmp(&b.sort).then_with(|| a.name.cmp(&b.name)));
    let items = list
        .into_iter()
        .map(|a| AgentItem {
            id: a.id,
            slug: a.slug,
            name: a.name,
            remark: a.remark,
            enabled: a.enabled,
            sort: a.sort,
        })
        .collect::<Vec<_>>();
    Json(items).into_response()
}

async fn list_agent_scripts(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    match crate::agents::service::list_bound_scripts(&app, &id).await {
        Ok(items) => Json(items).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn list_chat_skills(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let state = app.state::<AgentState>();
    let skills = state
        .skills
        .lock()
        .unwrap()
        .iter()
        .filter(|s| s.enabled && s.user_invocable)
        .map(|s| {
            json!({
                "id": s.name,
                "name": s.name,
                "description": s.description,
            })
        })
        .collect::<Vec<_>>();
    Json(skills).into_response()
}

async fn list_chat_mcp(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let state = app.state::<AgentState>();
    let items = state
        .mcp
        .lock()
        .await
        .server_infos()
        .into_iter()
        .map(|s| {
            json!({
                "id": s.name,
                "name": s.name,
                "description": s.config.description,
                "enabled": s.config.enabled,
            })
        })
        .collect::<Vec<_>>();
    Json(items).into_response()
}

async fn list_script_jobs(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    Json(crate::core::tools::run_page_script::list_jobs(&app)).into_response()
}

#[derive(Debug, Deserialize)]
struct ScriptJobResultBody {
    ok: bool,
    #[serde(default)]
    result: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

async fn complete_script_job(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
    Json(body): Json<ScriptJobResultBody>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    match crate::core::tools::run_page_script::complete_job(
        &app,
        &id,
        crate::core::tools::run_page_script::PageScriptResult {
            ok: body.ok,
            result: body.result,
            error: body.error,
        },
    ) {
        Ok(()) => Json(json!({ "ok": true })).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn set_session_agent(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
    Json(body): Json<SetSessionAgentRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let agent_id = body.agent_id.trim().to_string();
    if agent_id.is_empty() {
        return (StatusCode::BAD_REQUEST, "agent_id 不能为空").into_response();
    }
    let state = app.state::<AgentState>();
    match crate::chat::service::set_agent(&app, &state, &id, &agent_id).await {
        Ok(session) => {
            let _ = app.emit(
                "sessions-changed",
                json!({ "source": "extension", "session_id": session.id }),
            );
            Json(session).into_response()
        }
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn list_model_profiles(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let profiles = crate::models::service::list(&app)
        .await
        .into_iter()
        .filter(|p| p.enabled)
        .map(|p| ModelProfileItem {
            id: p.id,
            name: p.name,
            model: p.model,
            tier: p.tier,
            thinking: p.thinking,
            enabled: p.enabled,
        })
        .collect::<Vec<_>>();
    let cfg = app.state::<AgentState>().config.lock().unwrap().clone();
    Json(ModelProfilesResponse {
        profiles,
        active_profile_id: if cfg.auto_mode {
            None
        } else {
            cfg.active_profile_id
        },
        auto_mode: cfg.auto_mode,
    })
    .into_response()
}

async fn activate_model_profile(
    State(bridge): State<PublishBridge>,
    Json(body): Json<ActivateModelProfileRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let id = body
        .id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let list = crate::models::service::list(&app).await;
    let state = app.state::<AgentState>();
    let mut cfg = state.config.lock().unwrap();

    if let Some(ref profile_id) = id {
        let Some(p) = list.iter().find(|x| x.id == *profile_id) else {
            return (StatusCode::BAD_REQUEST, "模型配置不存在").into_response();
        };
        cfg.active_profile_id = Some(profile_id.clone());
        cfg.auto_mode = false;
        cfg.provider.kind = match p.kind.as_str() {
            "openai" => crate::common::config::ProviderKind::OpenAI,
            _ => crate::common::config::ProviderKind::Anthropic,
        };
        cfg.provider.model = p.model.clone();
        cfg.provider.base_url = p.base_url.clone();
        if !p.api_key.trim().is_empty() {
            cfg.provider.api_key = p.api_key.clone();
        }
    } else {
        cfg.auto_mode = true;
    }
    persist::save_config(&app, &cfg);
    let auto_mode = cfg.auto_mode;
    let active_profile_id = if auto_mode {
        None
    } else {
        cfg.active_profile_id.clone()
    };
    drop(cfg);

    Json(ModelProfilesResponse {
        profiles: list
            .into_iter()
            .filter(|p| p.enabled)
            .map(|p| ModelProfileItem {
                id: p.id,
                name: p.name,
                model: p.model,
                tier: p.tier,
                thinking: p.thinking,
                enabled: p.enabled,
            })
            .collect(),
        active_profile_id,
        auto_mode,
    })
    .into_response()
}

/// 与桌面 `session_list` 同源：置顶优先，再按 updated 降序。
async fn list_sessions(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let state = app.state::<AgentState>();
    let sessions = state.sessions.lock().unwrap();
    let mut list: Vec<&Session> = sessions.values().collect();
    list.sort_by(|a, b| match (a.pinned, b.pinned) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.updated.cmp(&a.updated),
    });
    let payload: Vec<serde_json::Value> = list
        .iter()
        .map(|s| {
            json!({
                "id": s.id,
                "title": s.title,
                "updated": s.updated,
                "message_count": s.messages.len(),
                "pinned": s.pinned,
                "agent_id": s.agent_id,
                "group_id": s.group_id,
            })
        })
        .collect();
    Json(payload).into_response()
}

async fn list_session_groups(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let mut list = crate::chat::service::list_groups(&app).await;
    list.sort_by(|a, b| {
        a.sort_order
            .cmp(&b.sort_order)
            .then_with(|| a.name.cmp(&b.name))
    });
    let items = list
        .into_iter()
        .map(|g| SessionGroupItem {
            id: g.id,
            name: g.name,
            sort_order: g.sort_order,
        })
        .collect::<Vec<_>>();
    Json(items).into_response()
}

async fn set_session_group(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
    Json(body): Json<SetSessionGroupRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let group_id = normalize_group_id(body.group_id);
    let state = app.state::<AgentState>();
    match crate::chat::service::set_session_group(&app, &state, &id, group_id).await {
        Ok(()) => {
            let session = state.sessions.lock().unwrap().get(&id).cloned();
            let _ = app.emit(
                "sessions-changed",
                json!({ "source": "extension", "session_id": id }),
            );
            match session {
                Some(s) => Json(s).into_response(),
                None => StatusCode::NO_CONTENT.into_response(),
            }
        }
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn delete_session(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    {
        let state = app.state::<AgentState>();
        let mut sessions = state.sessions.lock().unwrap();
        if sessions.remove(&id).is_none() {
            return (StatusCode::NOT_FOUND, "会话不存在").into_response();
        }
    }
    crate::chat::repository::delete(&app, &id).await;
    bridge.clear_bindings_for_session(&id);
    let map = bridge.page_bindings_snapshot();
    persist::save_page_bindings(&app, &map);
    let _ = app.emit(
        "sessions-changed",
        json!({ "source": "extension", "session_id": id }),
    );
    StatusCode::NO_CONTENT.into_response()
}

async fn rename_session(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
    Json(body): Json<RenameSessionRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let trimmed = body.title.trim().to_string();
    if trimmed.is_empty() {
        return (StatusCode::BAD_REQUEST, "标题不能为空").into_response();
    }
    let state = app.state::<AgentState>();
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let Some(session) = sessions.get_mut(&id) else {
            return (StatusCode::NOT_FOUND, "会话不存在").into_response();
        };
        session.title = trimmed;
        session.updated = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        session.clone()
    };
    crate::chat::repository::save(&app, &session).await;
    let _ = app.emit(
        "sessions-changed",
        json!({ "source": "extension", "session_id": id }),
    );
    StatusCode::NO_CONTENT.into_response()
}

async fn pin_session(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
    Json(body): Json<PinSessionRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let state = app.state::<AgentState>();
    let session = {
        let mut sessions = state.sessions.lock().unwrap();
        let Some(session) = sessions.get_mut(&id) else {
            return (StatusCode::NOT_FOUND, "会话不存在").into_response();
        };
        session.pinned = body.pinned;
        session.clone()
    };
    crate::chat::repository::save(&app, &session).await;
    let _ = app.emit(
        "sessions-changed",
        json!({ "source": "extension", "session_id": id }),
    );
    StatusCode::NO_CONTENT.into_response()
}

async fn ensure_session(
    State(bridge): State<PublishBridge>,
    Json(body): Json<SessionEnsureRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let page_key = normalize_page_key(&body.page_key);
    if page_key.is_empty() {
        return (StatusCode::BAD_REQUEST, "page_key 不能为空").into_response();
    }

    if let Some(sid) = bridge.get_page_binding(&page_key) {
        let state = app.state::<AgentState>();
        let exists = state.sessions.lock().unwrap().contains_key(&sid);
        if exists {
            return Json(SessionEnsureResponse {
                session_id: sid,
                created: false,
            })
            .into_response();
        }
    }

    let title = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("New Chat")
        .to_string();

    let mut session = Session::new(title);
    session.group_id = resolve_group_id(&app, body.group_id).await;
    let sid = session.id.clone();
    crate::chat::repository::save(&app, &session).await;
    {
        let state = app.state::<AgentState>();
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(sid.clone(), session);
    }
    bind_and_persist(&bridge, &page_key, &sid);

    Json(SessionEnsureResponse {
        session_id: sid,
        created: true,
    })
    .into_response()
}

async fn reset_session(
    State(bridge): State<PublishBridge>,
    Json(body): Json<SessionResetRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let page_key = normalize_page_key(&body.page_key);
    if page_key.is_empty() {
        return (StatusCode::BAD_REQUEST, "page_key 不能为空").into_response();
    }

    let title = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("New Chat")
        .to_string();

    let mut session = Session::new(title);
    session.group_id = resolve_group_id(&app, body.group_id).await;
    let sid = session.id.clone();
    crate::chat::repository::save(&app, &session).await;
    {
        let state = app.state::<AgentState>();
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(sid.clone(), session);
    }
    bind_and_persist(&bridge, &page_key, &sid);

    Json(SessionEnsureResponse {
        session_id: sid,
        created: true,
    })
    .into_response()
}

async fn get_session(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    let state = app.state::<AgentState>();
    let session = state.sessions.lock().unwrap().get(&id).cloned();
    match session {
        Some(session) => Json(session).into_response(),
        None => (StatusCode::NOT_FOUND, "session not found").into_response(),
    }
}

async fn chat_send_sse(
    State(bridge): State<PublishBridge>,
    Json(body): Json<ChatSendRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };

    let content = body.content.trim().to_string();
    if content.is_empty() {
        return (StatusCode::BAD_REQUEST, "content 不能为空").into_response();
    }

    let page_key = body
        .page_key
        .as_deref()
        .map(normalize_page_key)
        .filter(|s| !s.is_empty());

    // 先解析/创建 session，保证 SSE 过滤用已知 session_id
    let mut session_id = body.session_id.filter(|s| !s.trim().is_empty());
    if session_id.is_none() && !body.force_new {
        session_id = page_key.as_ref().and_then(|pk| bridge.get_page_binding(pk));
    }

    if let Some(ref sid) = session_id {
        let exists = app
            .state::<AgentState>()
            .sessions
            .lock()
            .unwrap()
            .contains_key(sid);
        if !exists {
            session_id = None;
        }
    }

    let create_group_id = resolve_group_id(&app, body.group_id.clone()).await;

    if session_id.is_none() {
        let title = "New Chat".to_string();
        let mut session = Session::new(title);
        session.group_id = create_group_id.clone();
        let sid = session.id.clone();
        crate::chat::repository::save(&app, &session).await;
        {
            let state = app.state::<AgentState>();
            let mut sessions = state.sessions.lock().unwrap();
            sessions.insert(sid.clone(), session);
        }
        if let Some(ref pk) = page_key {
            bind_and_persist(&bridge, pk, &sid);
        }
        session_id = Some(sid);
    } else if let (Some(ref pk), Some(ref sid)) = (&page_key, &session_id) {
        bind_and_persist(&bridge, pk, sid);
    }

    let session_id = session_id.expect("session_id resolved");
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Result<Event, Infallible>>();
    let tx_listen = tx.clone();
    let sid_filter = session_id.clone();

    let listen_id = app.listen("stream-chunk", move |event| {
        let payload = event.payload();
        let Ok(chunk) = serde_json::from_str::<StreamChunk>(payload) else {
            return;
        };
        if chunk.session_id != sid_filter {
            return;
        }
        let _ = tx_listen.send(Ok(Event::default()
            .event("stream-chunk")
            .data(payload.to_string())));
    });

    let app2 = app.clone();
    let bridge2 = bridge.clone();
    let page_key_for_bind = page_key.clone();
    let sid_for_send = session_id.clone();
    let chat_mode = body
        .chat_mode
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let agent_id = body
        .agent_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let attachments = body.attachments;
    tauri::async_runtime::spawn(async move {
        let state = app2.state::<AgentState>();
        let result = send_message(
            app2.clone(),
            state,
            Some(sid_for_send.clone()),
            content,
            chat_mode,
            None,
            agent_id,
            attachments,
        )
        .await;

        match result {
            Ok(sid) => {
                if let Some(ref pk) = page_key_for_bind {
                    bridge2.set_page_binding(pk, &sid);
                    let map = bridge2.page_bindings_snapshot();
                    persist::save_page_bindings(&app2, &map);
                }
                let _ = app2.emit(
                    "sessions-changed",
                    json!({ "source": "extension", "session_id": sid }),
                );
                let _ = tx.send(Ok(Event::default()
                    .event("done")
                    .data(json!({ "session_id": sid }).to_string())));
            }
            Err(e) => {
                let _ = tx.send(Ok(Event::default().event("error").data(
                    json!({ "message": e.to_string() }).to_string(),
                )));
            }
        }

        app2.unlisten(listen_id);
    });

    let stream = UnboundedReceiverStream::new(rx);
    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}
