//! 浏览器扩展智能会话桥：page_key ↔ session，转发 chat_send，SSE 推送 stream-chunk。
//! 挂载在发布桥同一端口 `127.0.0.1:17890` 的 `/chat/*`。

use std::convert::Infallible;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{Emitter, Listener, Manager};
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::agent::AgentState;
use crate::chat::service::send_message;
use crate::chat::Session;
use crate::persist;
use crate::provider::StreamChunk;
use crate::publish::PublishBridge;

#[derive(Debug, Deserialize)]
pub struct SessionEnsureRequest {
    pub page_key: String,
    #[serde(default)]
    pub title: Option<String>,
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
    let modes = crate::permission::list_modes(&cfg)
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
    match crate::permission::set_active_mode(&mut app_cfg.permission, &id) {
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
        crate::config::ProviderKind::OpenAI => "openai",
        crate::config::ProviderKind::Anthropic => "anthropic",
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
        "openai" => crate::config::ProviderKind::OpenAI,
        _ => crate::config::ProviderKind::Anthropic,
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
        crate::config::ProviderKind::OpenAI => "openai",
        crate::config::ProviderKind::Anthropic => "anthropic",
    };
    Json(ModelConfigResponse {
        kind: kind_str.to_string(),
        model: cfg.provider.model.clone(),
        base_url: cfg.provider.base_url.clone().unwrap_or_default(),
        has_api_key: !cfg.provider.api_key.trim().is_empty(),
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
            })
        })
        .collect();
    Json(payload).into_response()
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

    let session = Session::new(title);
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

    let session = Session::new(title);
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

    if session_id.is_none() {
        let title = "New Chat".to_string();
        let session = Session::new(title);
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
    tauri::async_runtime::spawn(async move {
        let state = app2.state::<AgentState>();
        let result = send_message(
            app2.clone(),
            state,
            Some(sid_for_send.clone()),
            None,
            content,
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
