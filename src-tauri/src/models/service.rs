use serde_json::Value;
use tauri::AppHandle;
use uuid::Uuid;

use super::{repository as repo, ProviderProfile};

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

pub async fn list(app: &AppHandle) -> Vec<ProviderProfile> {
    repo::list(app).await
}

pub async fn get(app: &AppHandle, id: &str) -> Option<ProviderProfile> {
    repo::get(app, id).await
}

#[allow(clippy::too_many_arguments)]
pub async fn add(
    app: &AppHandle,
    name: String,
    kind: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    tier: String,
    weight: i64,
    context_window: i64,
    // 新增参数（均有默认值，前端可不传）
    capabilities: Option<Value>,
    thinking: Option<bool>,
    thinking_effort: Option<String>,
    temperature: Option<f64>,
    max_output_tokens: Option<i64>,
    extra_body: Option<Value>,
    tags: Option<Vec<String>>,
) -> Result<ProviderProfile, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    let p = ProviderProfile {
        id: Uuid::new_v4().to_string(),
        name,
        kind,
        api_key,
        model,
        base_url,
        tier,
        weight: weight.clamp(1, 4),
        context_window,
        enabled: true,
        created: now_ms(),
        updated: now_ms(),
        capabilities: capabilities.unwrap_or_else(|| Value::Object(Default::default())),
        thinking: thinking.unwrap_or(false),
        thinking_effort: thinking_effort.unwrap_or_else(|| "medium".into()),
        temperature,
        max_output_tokens,
        extra_body: extra_body.unwrap_or_else(|| Value::Object(Default::default())),
        tags: tags.unwrap_or_default(),
    };
    repo::insert(app, &p).await.map_err(|e| format!("写入失败：{e}"))?;
    Ok(p)
}

#[allow(clippy::too_many_arguments)]
pub async fn update(
    app: &AppHandle,
    id: String,
    name: String,
    kind: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    tier: String,
    weight: i64,
    context_window: i64,
    enabled: bool,
    // 新增参数；thinking 必传，确保「关闭」一定写回 false
    capabilities: Option<Value>,
    thinking: bool,
    thinking_effort: Option<String>,
    temperature: Option<f64>,
    max_output_tokens: Option<i64>,
    extra_body: Option<Value>,
    tags: Option<Vec<String>>,
) -> Result<ProviderProfile, String> {
    let mut p = repo::get(app, &id).await.ok_or("Profile 不存在")?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    p.name = name;
    p.kind = kind;
    p.api_key = api_key;
    p.model = model;
    p.base_url = base_url;
    p.tier = tier;
    p.weight = weight.clamp(1, 4);
    p.context_window = context_window;
    p.enabled = enabled;
    p.thinking = thinking;
    p.updated = now_ms();
    if let Some(v) = capabilities    { p.capabilities = v; }
    if let Some(v) = thinking_effort { p.thinking_effort = v; }
    if temperature.is_some()         { p.temperature = temperature; }
    if max_output_tokens.is_some()   { p.max_output_tokens = max_output_tokens; }
    if let Some(v) = extra_body      { p.extra_body = v; }
    if let Some(v) = tags            { p.tags = v; }
    repo::update(app, &p).await?;
    Ok(p)
}

pub async fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    if repo::get(app, &id).await.is_none() {
        return Err("Profile 不存在".into());
    }
    repo::remove(app, &id).await;
    Ok(())
}

/// 启动时补齐 model_profile（幂等）。
///
/// 顺序：
/// 1. 若使用自定义 `data_root`，从系统默认目录的 `chatcms.db` 导入缺失档案
///    （避免换数据目录后扩展/桥只剩 JSON 里的「默认」）
/// 2. 若仍为空，再从旧 `chatcms.json` profiles 迁移
pub async fn migrate_from_legacy(app: &AppHandle, legacy_profiles: Vec<crate::common::config::ProviderProfile>) {
    import_missing_from_default_app_db(app).await;

    let existing = repo::list(app).await;
    if !existing.is_empty() {
        return;
    }
    let now = now_ms();
    for (i, lp) in legacy_profiles.iter().enumerate() {
        let kind = match lp.kind {
            crate::common::config::ProviderKind::Anthropic => "anthropic",
            crate::common::config::ProviderKind::OpenAI => "openai",
        };
        let p = ProviderProfile {
            id: lp.id.clone(),
            name: lp.name.clone(),
            kind: kind.to_string(),
            api_key: lp.api_key.clone(),
            model: lp.model.clone(),
            base_url: lp.base_url.clone(),
            tier: "cloud".to_string(),
            weight: 2,
            context_window: 8192,
            enabled: true,
            created: now + i as i64,
            updated: now + i as i64,
            capabilities: Value::Object(Default::default()),
            thinking: false,
            thinking_effort: "medium".into(),
            temperature: None,
            max_output_tokens: None,
            extra_body: Value::Object(Default::default()),
            tags: vec![],
        };
        let _ = repo::insert(app, &p).await;
    }
}

/// 自定义 data_root 时，把默认 app_data_dir 里已有的模型档案补进当前库（按 id 跳过已存在）。
async fn import_missing_from_default_app_db(app: &AppHandle) {
    use sqlx::Row;

    let current = crate::common::config::resolve_data_root(app);
    let default = crate::common::config::default_data_root(app);
    if current == default {
        return;
    }
    let src_path = default.join("chatcms.db");
    if !src_path.is_file() {
        return;
    }

    let url = format!("sqlite://{}?mode=ro", src_path.display());
    let Ok(src_pool) = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
    else {
        return;
    };

    let rows = sqlx::query(
        "SELECT id, name, kind, api_key, model, base_url, tier, weight, context_window,
                enabled, created, updated,
                capabilities, thinking, thinking_effort, temperature, max_output_tokens,
                extra_body, tags
         FROM model_profile",
    )
    .fetch_all(&src_pool)
    .await
    .unwrap_or_default();
    src_pool.close().await;

    if rows.is_empty() {
        return;
    }

    let existing: std::collections::HashSet<String> = repo::list(app)
        .await
        .into_iter()
        .map(|p| p.id)
        .collect();

    for r in rows {
        let id: String = r.get("id");
        if existing.contains(&id) {
            continue;
        }
        let enabled: i64 = r.get("enabled");
        let thinking: i64 = r.try_get("thinking").unwrap_or(0);
        let capabilities_str: String = r.try_get("capabilities").unwrap_or_else(|_| "{}".into());
        let extra_body_str: String = r.try_get("extra_body").unwrap_or_else(|_| "{}".into());
        let tags_str: String = r.try_get("tags").unwrap_or_else(|_| "[]".into());
        let p = ProviderProfile {
            id,
            name: r.get("name"),
            kind: r.get("kind"),
            api_key: r.get("api_key"),
            model: r.get("model"),
            base_url: r.get("base_url"),
            tier: r.get("tier"),
            weight: r.get("weight"),
            context_window: r.get("context_window"),
            enabled: enabled != 0,
            created: r.get("created"),
            updated: r.get("updated"),
            capabilities: serde_json::from_str(&capabilities_str)
                .unwrap_or_else(|_| Value::Object(Default::default())),
            thinking: thinking != 0,
            thinking_effort: r.try_get("thinking_effort").unwrap_or_else(|_| "medium".into()),
            temperature: r.try_get("temperature").unwrap_or(None),
            max_output_tokens: r.try_get("max_output_tokens").unwrap_or(None),
            extra_body: serde_json::from_str(&extra_body_str)
                .unwrap_or_else(|_| Value::Object(Default::default())),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
        };
        let _ = repo::insert(app, &p).await;
    }
}
