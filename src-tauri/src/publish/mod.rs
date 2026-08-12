//! 本机发布桥：把草稿与媒体暴露给浏览器插件（自动填表）。
//! 默认监听 `127.0.0.1:17890`。

pub mod commands;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

use crate::medias;
use crate::persist;

pub const BRIDGE_PORT: u16 = 17890;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishDraft {
    pub id: String,
    /// 完整 SyncData（MultiPost / chatcms-extesion 协议）
    pub sync_data: Value,
    pub created_at: u64,
}

#[derive(Clone)]
pub struct PublishBridge {
    inner: Arc<PublishInner>,
}

struct PublishInner {
    app: Mutex<Option<AppHandle>>,
    drafts: Mutex<HashMap<String, PublishDraft>>,
    /// 扩展 page_key → session_id
    page_bindings: Mutex<HashMap<String, String>>,
    started: AtomicBool,
}

impl PublishBridge {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(PublishInner {
                app: Mutex::new(None),
                drafts: Mutex::new(HashMap::new()),
                page_bindings: Mutex::new(HashMap::new()),
                started: AtomicBool::new(false),
            }),
        }
    }

    pub fn bind_app(&self, app: AppHandle) {
        *self.inner.app.lock().unwrap() = Some(app.clone());
        let bindings = persist::load_page_bindings(&app);
        *self.inner.page_bindings.lock().unwrap() = bindings;
    }

    pub fn app_handle(&self) -> Option<AppHandle> {
        self.inner.app.lock().unwrap().clone()
    }

    pub fn get_page_binding(&self, page_key: &str) -> Option<String> {
        self.inner
            .page_bindings
            .lock()
            .unwrap()
            .get(page_key)
            .cloned()
    }

    pub fn set_page_binding(&self, page_key: &str, session_id: &str) {
        self.inner
            .page_bindings
            .lock()
            .unwrap()
            .insert(page_key.to_string(), session_id.to_string());
    }

    /// 清除指向某 session 的所有 page_key 绑定。
    pub fn clear_bindings_for_session(&self, session_id: &str) {
        let mut map = self.inner.page_bindings.lock().unwrap();
        map.retain(|_, sid| sid != session_id);
    }

    pub fn page_bindings_snapshot(&self) -> HashMap<String, String> {
        self.inner.page_bindings.lock().unwrap().clone()
    }

    pub fn base_url() -> String {
        format!("http://127.0.0.1:{BRIDGE_PORT}")
    }

    pub async fn ensure_running(&self) -> Result<(), String> {
        if self.inner.started.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let state = self.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = run_server(state).await {
                eprintln!("[publish-bridge] server error: {e}");
                // 允许下次重试绑定
            }
        });
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        Ok(())
    }

    pub fn put_draft(&self, sync_data: Value) -> PublishDraft {
        let id = Uuid::new_v4().to_string();
        let draft = PublishDraft {
            id: id.clone(),
            sync_data,
            created_at: now_secs(),
        };
        self.inner
            .drafts
            .lock()
            .unwrap()
            .insert(id, draft.clone());
        draft
    }

    pub fn get_draft(&self, id: &str) -> Option<PublishDraft> {
        self.inner.drafts.lock().unwrap().get(id).cloned()
    }

    fn resolve_media(&self, kind: &str, id: &str) -> Option<PathBuf> {
        let app = self.app_handle()?;
        let id = id.to_owned();
        tokio::task::block_in_place(|| {
            let handle = tokio::runtime::Handle::current();
            match kind {
                "image" => handle.block_on(persist::load_all_images(&app))
                    .into_iter()
                    .find(|i| i.id == id)
                    .map(|i| PathBuf::from(i.path)),
                "video" => handle.block_on(persist::load_all_videos(&app))
                    .into_iter()
                    .find(|v| v.id == id)
                    .map(|v| PathBuf::from(v.path)),
                _ => None,
            }
        })
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

async fn run_server(bridge: PublishBridge) -> Result<(), String> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(index_page))
        .route("/bridge", get(bridge_page))
        .route("/api/draft/{id}", get(get_draft))
        .route("/media/import", post(import_media))
        .route("/media/{kind}/{id}", get(get_media))
        .route("/publish/platforms", get(list_publish_platforms))
        .route("/publish/script", get(get_publish_script))
        .route("/collect/script", get(get_collect_script))
        // 插件导航同源业务地图（常用工具 + 分类 + 网站）；旧 /nav/bookmarks 已废弃
        .route("/map", get(get_map_nav))
        .route("/map/links", post(create_map_link))
        .route(
            "/map/links/{id}",
            put(update_map_link).delete(delete_map_link),
        )
        .route("/health", get(|| async { "ok" }))
        .merge(crate::bridge::routes())
        .layer(cors)
        .with_state(bridge);

    let addr = SocketAddr::from(([127, 0, 0, 1], BRIDGE_PORT));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("绑定发布桥端口失败 {BRIDGE_PORT}: {e}"))?;
    eprintln!("[publish-bridge] listening on http://127.0.0.1:{BRIDGE_PORT}");
    axum::serve(listener, app)
        .await
        .map_err(|e| e.to_string())
}

async fn index_page() -> Html<&'static str> {
    Html(
        "<!doctype html><meta charset=utf-8><title>ChatCMS Local Bridge</title>\
         <p>ChatCMS 本机桥运行中（发布 + 扩展智能会话）。</p>",
    )
}

async fn bridge_page() -> Html<&'static str> {
    Html(BRIDGE_HTML)
}

async fn get_draft(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
) -> Response {
    match bridge.get_draft(&id) {
        Some(d) => Json(d).into_response(),
        None => (StatusCode::NOT_FOUND, "draft not found").into_response(),
    }
}

async fn list_publish_platforms(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "bridge app not ready").into_response();
    };
    Json(medias::bridge_list_platforms(&app)).into_response()
}

#[derive(Debug, Deserialize)]
struct PublishScriptQuery {
    /// 平台 code（如 DYNAMIC_REDNOTE）或内部 id
    platform: String,
    #[serde(default)]
    kind: Option<String>,
}

async fn get_publish_script(
    State(bridge): State<PublishBridge>,
    Query(q): Query<PublishScriptQuery>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "bridge app not ready").into_response();
    };
    match medias::bridge_get_script(&app, &q.platform) {
        Ok(script) => {
            if let Some(kind) = q.kind.filter(|k| !k.trim().is_empty()) {
                if !script.kind.eq_ignore_ascii_case(kind.trim()) {
                    return (
                        StatusCode::NOT_FOUND,
                        format!("脚本类型不匹配，期望 {}，实际 {}", kind, script.kind),
                    )
                        .into_response();
                }
            }
            Json(script).into_response()
        }
        Err(e) => (StatusCode::NOT_FOUND, e).into_response(),
    }
}

async fn get_collect_script(
    State(bridge): State<PublishBridge>,
    Query(q): Query<PublishScriptQuery>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "bridge app not ready").into_response();
    };
    match medias::bridge_get_collect_script(&app, &q.platform) {
        Ok(script) => {
            if let Some(kind) = q.kind.filter(|k| !k.trim().is_empty()) {
                if !script.kind.eq_ignore_ascii_case(kind.trim()) {
                    return (
                        StatusCode::NOT_FOUND,
                        format!("脚本类型不匹配，期望 {}，实际 {}", kind, script.kind),
                    )
                        .into_response();
                }
            }
            Json(script).into_response()
        }
        Err(e) => (StatusCode::NOT_FOUND, e).into_response(),
    }
}

async fn get_map_nav(State(bridge): State<PublishBridge>) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "bridge app not ready").into_response();
    };
    Json(crate::business_map::nav_view(&app)).into_response()
}

#[derive(Debug, Deserialize)]
struct MapLinkBody {
    /// `"favorites"` 或分类 id
    section_id: String,
    title: String,
    #[serde(default)]
    desc: String,
    #[serde(default)]
    mark: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    tone: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MapLinkDeleteQuery {
    section_id: String,
}

async fn create_map_link(
    State(bridge): State<PublishBridge>,
    Json(body): Json<MapLinkBody>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "bridge app not ready").into_response();
    };
    match crate::business_map::upsert_link(
        &app,
        &body.section_id,
        None,
        body.title,
        body.desc,
        body.mark,
        body.url,
        body.tone,
    ) {
        Ok(item) => (StatusCode::CREATED, Json(item)).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn update_map_link(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
    Json(body): Json<MapLinkBody>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "bridge app not ready").into_response();
    };
    match crate::business_map::upsert_link(
        &app,
        &body.section_id,
        Some(id),
        body.title,
        body.desc,
        body.mark,
        body.url,
        body.tone,
    ) {
        Ok(item) => Json(item).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn delete_map_link(
    State(bridge): State<PublishBridge>,
    Path(id): Path<String>,
    Query(q): Query<MapLinkDeleteQuery>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "bridge app not ready").into_response();
    };
    match crate::business_map::remove_link(&app, &q.section_id, &id) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::NOT_FOUND, e).into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct MediaImportItem {
    kind: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    page_url: Option<String>,
    #[serde(default)]
    title: Option<String>,
    /// 扩展侧临时 id，原样回传便于对账
    #[serde(default)]
    client_id: Option<String>,
    /// 扩展已下载的文件（base64）；有则跳过桌面二次下载
    #[serde(default)]
    data_base64: Option<String>,
    #[serde(default)]
    content_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MediaImportRequest {
    items: Vec<MediaImportItem>,
}

#[derive(Debug, Serialize)]
struct MediaImportResultItem {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct MediaImportResponse {
    results: Vec<MediaImportResultItem>,
}

fn decode_import_bytes(item: &MediaImportItem) -> Result<Vec<u8>, String> {
    let Some(b64) = item.data_base64.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
        return Err("missing data".into());
    };
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("base64 解码失败: {e}"))
}

/// 扩展采集页媒体 → 下载并写入桌面图片/视频库。
async fn import_media(
    State(bridge): State<PublishBridge>,
    Json(req): Json<MediaImportRequest>,
) -> Response {
    let Some(app) = bridge.app_handle() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "ChatCMS 未就绪").into_response();
    };
    if req.items.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            "items 不能为空",
        )
            .into_response();
    }
    if req.items.len() > 20 {
        return (StatusCode::BAD_REQUEST, "单次最多导入 20 项").into_response();
    }

    let mut results = Vec::with_capacity(req.items.len());
    for item in req.items {
        let kind = item.kind.trim().to_lowercase();
        let page_url = item.page_url.as_deref();
        let title = item.title.as_deref();
        let client_id = item.client_id.clone();
        let content_type = item.content_type.clone().unwrap_or_default();
        let source_hint = if item.url.trim().is_empty() {
            "import"
        } else {
            item.url.trim()
        };
        let has_bytes = item
            .data_base64
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_some();

        let outcome = match kind.as_str() {
            "image" => {
                let result = if has_bytes {
                    match decode_import_bytes(&item) {
                        Ok(bytes) => crate::images::import_bytes(
                            &app,
                            bytes,
                            &content_type,
                            source_hint,
                            title,
                            "web_import",
                        ).await,
                        Err(e) => Err(anyhow::anyhow!(e)),
                    }
                } else {
                    crate::images::import_from_url(&app, &item.url, page_url, title).await
                };
                match result {
                    Ok(img) => MediaImportResultItem {
                        ok: true,
                        client_id,
                        kind: Some("image".into()),
                        id: Some(img.id),
                        error: None,
                    },
                    Err(e) => MediaImportResultItem {
                        ok: false,
                        client_id,
                        kind: Some("image".into()),
                        id: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "video" => {
                let result = if has_bytes {
                    match decode_import_bytes(&item) {
                        Ok(bytes) => crate::videos::import_bytes(
                            &app,
                            bytes,
                            &content_type,
                            source_hint,
                            title,
                            "web_import",
                        ).await,
                        Err(e) => Err(anyhow::anyhow!(e)),
                    }
                } else {
                    crate::videos::import_from_url(&app, &item.url, page_url, title).await
                };
                match result {
                    Ok(vid) => MediaImportResultItem {
                        ok: true,
                        client_id,
                        kind: Some("video".into()),
                        id: Some(vid.id),
                        error: None,
                    },
                    Err(e) => MediaImportResultItem {
                        ok: false,
                        client_id,
                        kind: Some("video".into()),
                        id: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            _ => MediaImportResultItem {
                ok: false,
                client_id,
                kind: Some(kind),
                id: None,
                error: Some("kind 须为 image 或 video".into()),
            },
        };
        results.push(outcome);
    }

    Json(MediaImportResponse { results }).into_response()
}

async fn get_media(
    State(bridge): State<PublishBridge>,
    Path((kind, id)): Path<(String, String)>,
) -> Response {
    if kind == "placeholder" {
        return placeholder_png();
    }
    let Some(path) = bridge.resolve_media(&kind, &id) else {
        return (StatusCode::NOT_FOUND, "media not found").into_response();
    };
    let Ok(bytes) = tokio::fs::read(&path).await else {
        return (StatusCode::NOT_FOUND, "file missing").into_response();
    };
    let mime = mime_for(&path);
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
    headers.insert(header::CACHE_CONTROL, "no-cache".parse().unwrap());
    (headers, Body::from(bytes)).into_response()
}

fn mime_for(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        _ => "application/octet-stream",
    }
}

fn placeholder_png() -> Response {
    const PNG: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "image/png".parse().unwrap());
    (headers, Body::from(PNG)).into_response()
}

const BRIDGE_HTML: &str = r#"<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ChatCMS · 发布到浏览器</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0f1115; color: #e8eaed; }
    .card { width: min(440px, 92vw); padding: 28px 24px; border-radius: 16px;
      background: #1a1d24; border: 1px solid #2a2f3a; box-shadow: 0 16px 40px #0006; }
    h1 { margin: 0 0 8px; font-size: 18px; font-weight: 650; }
    p { margin: 0 0 10px; font-size: 13px; line-height: 1.55; color: #a8b0bd; }
    .status { margin-top: 16px; padding: 12px 14px; border-radius: 10px;
      background: #12151b; font-size: 13px; white-space: pre-wrap; }
    .ok { color: #6ee7b7; } .err { color: #fca5a5; } .info { color: #93c5fd; }
    button { margin-top: 14px; width: 100%; padding: 10px 14px; border: 0; border-radius: 10px;
      background: #3b82f6; color: #fff; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: .5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="card">
    <h1>发布到浏览器插件</h1>
    <p>将把标题、正文与媒体自动填入平台创作者页。请确认已安装插件，并已在浏览器登录目标平台。</p>
    <div id="status" class="status info">准备中…</div>
    <button id="retry" type="button" disabled>重试</button>
  </div>
  <script>
  const statusEl = document.getElementById('status');
  const retryBtn = document.getElementById('retry');
  const draftId = new URLSearchParams(location.search).get('id');

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status ' + (cls || 'info');
  }

  function request(action, data) {
    const traceId = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMsg);
        resolve({ code: 504, message: '插件未响应（请确认已安装并启用）', data: null });
      }, 15000);
      function onMsg(e) {
        if (e.data && e.data.type === 'response' && e.data.traceId === traceId) {
          clearTimeout(timer);
          window.removeEventListener('message', onMsg);
          resolve(e.data);
        }
      }
      window.addEventListener('message', onMsg);
      window.postMessage({ type: 'request', traceId, action, data: data || null }, '*');
    });
  }

  async function run() {
    retryBtn.disabled = true;
    if (!draftId) {
      setStatus('缺少草稿 id', 'err');
      retryBtn.disabled = false;
      return;
    }
    setStatus('读取草稿…', 'info');
    let draft;
    try {
      const res = await fetch('/api/draft/' + encodeURIComponent(draftId));
      if (!res.ok) throw new Error('草稿不存在或已过期');
      draft = await res.json();
    } catch (e) {
      setStatus(String(e.message || e), 'err');
      retryBtn.disabled = false;
      return;
    }

    setStatus('检查插件信任…', 'info');
    const trust = await request('MULTIPOST_EXTENSION_REQUEST_TRUST_DOMAIN', null);
    if (trust.code === 504) {
      setStatus('未检测到浏览器插件。请安装 chatcms-extesion，并刷新本页。', 'err');
      retryBtn.disabled = false;
      return;
    }

    setStatus('正在交给插件自动填表…', 'info');
    const pub = await request('MULTIPOST_EXTENSION_PUBLISH', draft.sync_data);
    if (pub.code === 0) {
      setStatus('已交给插件。请看浏览器右侧边栏（若未出现，点击工具栏插件图标打开）。侧栏会自动填表；请在平台页面中确认后发布。', 'ok');
    } else if (pub.code === 403) {
      setStatus('域名未受信任。请在弹出窗口中允许信任 127.0.0.1，然后点重试。', 'err');
      retryBtn.disabled = false;
    } else {
      setStatus('插件返回：' + (pub.message || ('code ' + pub.code)), 'err');
      retryBtn.disabled = false;
    }
  }

  retryBtn.addEventListener('click', () => run());
  run();
  </script>
</body>
</html>
"#;

/// 确保桥接服务已启动，写入草稿并在系统浏览器打开桥接页。
pub async fn prepare_and_open(
    bridge: &PublishBridge,
    app: &AppHandle,
    sync_data: Value,
) -> Result<String, String> {
    bridge.bind_app(app.clone());
    bridge.ensure_running().await?;
    let draft = bridge.put_draft(sync_data);
    let url = format!("{}/bridge?id={}", PublishBridge::base_url(), draft.id);
    tauri_plugin_opener::open_url(&url, None::<&str>).map_err(|e| e.to_string())?;
    Ok(url)
}

pub fn media_url(kind: &str, id: &str) -> String {
    format!("{}/media/{kind}/{id}", PublishBridge::base_url())
}

pub fn placeholder_cover_url() -> String {
    format!(
        "{}/media/placeholder/cover.png",
        PublishBridge::base_url()
    )
}
