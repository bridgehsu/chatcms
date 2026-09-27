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

fn normalize_modality(raw: Option<String>) -> String {
    match raw.as_deref().map(str::trim).unwrap_or("chat") {
        "image" => "image".into(),
        "video" => "video".into(),
        _ => "chat".into(),
    }
}

fn normalize_image_kind(kind: &str) -> String {
    match kind.trim().to_ascii_lowercase().as_str() {
        "dashscope" | "qwen" => "dashscope".into(),
        _ => "openai".into(),
    }
}

/// 按用途整理参数：图片/视频不走会话思考与路由权重语义
fn apply_modality_defaults(p: &mut ProviderProfile) {
    match p.modality_key() {
        "image" => {
            p.thinking = false;
            p.thinking_effort = "medium".into();
            p.temperature = None;
            p.max_output_tokens = None;
            // 图片：kind = 生图协议（openai Images API / dashscope 多模态）
            p.kind = normalize_image_kind(&p.kind);
            let mut caps = serde_json::Map::new();
            caps.insert("image".into(), Value::Bool(true));
            p.capabilities = Value::Object(caps);
            if !p.tags.iter().any(|t| t == "image") {
                p.tags.push("image".into());
            }
        }
        "video" => {
            p.thinking = false;
            p.thinking_effort = "medium".into();
            p.temperature = None;
            p.max_output_tokens = None;
            if p.kind != "openai" {
                p.kind = "openai".into();
            }
            let mut caps = serde_json::Map::new();
            caps.insert("video".into(), Value::Bool(true));
            p.capabilities = Value::Object(caps);
            if !p.tags.iter().any(|t| t == "video") {
                p.tags.push("video".into());
            }
        }
        _ => {
            p.modality = "chat".into();
        }
    }
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
    modality: Option<String>,
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
    let mut p = ProviderProfile {
        id: Uuid::new_v4().to_string(),
        name,
        kind,
        api_key,
        model,
        base_url,
        tier,
        modality: normalize_modality(modality),
        weight: weight.clamp(1, 4),
        context_window: if context_window > 0 { context_window } else { 8192 },
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
    apply_modality_defaults(&mut p);
    repo::insert(app, &p)
        .await
        .map_err(|e| format!("写入失败：{e}"))?;
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
    modality: Option<String>,
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
    p.context_window = if context_window > 0 { context_window } else { 8192 };
    p.enabled = enabled;
    p.thinking = thinking;
    p.updated = now_ms();
    if let Some(m) = modality {
        p.modality = normalize_modality(Some(m));
    }
    if let Some(v) = capabilities {
        p.capabilities = v;
    }
    if let Some(v) = thinking_effort {
        p.thinking_effort = v;
    }
    if temperature.is_some() {
        p.temperature = temperature;
    }
    if max_output_tokens.is_some() {
        p.max_output_tokens = max_output_tokens;
    }
    if let Some(v) = extra_body {
        p.extra_body = v;
    }
    if let Some(v) = tags {
        p.tags = v;
    }
    apply_modality_defaults(&mut p);
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
pub async fn migrate_from_legacy(
    app: &AppHandle,
    legacy_profiles: Vec<crate::common::config::ProviderProfile>,
) {
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
            modality: "chat".into(),
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
                extra_body, tags, modality
         FROM model_profile",
    )
    .fetch_all(&src_pool)
    .await
    .unwrap_or_else(|_| {
        // 旧库可能尚无 modality 列
        Vec::new()
    });

    let rows = if rows.is_empty() {
        sqlx::query(
            "SELECT id, name, kind, api_key, model, base_url, tier, weight, context_window,
                    enabled, created, updated,
                    capabilities, thinking, thinking_effort, temperature, max_output_tokens,
                    extra_body, tags
             FROM model_profile",
        )
        .fetch_all(&src_pool)
        .await
        .unwrap_or_default()
    } else {
        rows
    };
    src_pool.close().await;

    if rows.is_empty() {
        return;
    }

    let existing: std::collections::HashSet<String> =
        repo::list(app).await.into_iter().map(|p| p.id).collect();

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
        let modality_raw: String = r.try_get("modality").unwrap_or_else(|_| "chat".into());
        let p = ProviderProfile {
            id,
            name: r.get("name"),
            kind: r.get("kind"),
            api_key: r.get("api_key"),
            model: r.get("model"),
            base_url: r.get("base_url"),
            tier: r.get("tier"),
            modality: normalize_modality(Some(modality_raw)),
            weight: r.get("weight"),
            context_window: r.get("context_window"),
            enabled: enabled != 0,
            created: r.get("created"),
            updated: r.get("updated"),
            capabilities: serde_json::from_str(&capabilities_str)
                .unwrap_or_else(|_| Value::Object(Default::default())),
            thinking: thinking != 0,
            thinking_effort: r
                .try_get("thinking_effort")
                .unwrap_or_else(|_| "medium".into()),
            temperature: r.try_get("temperature").unwrap_or(None),
            max_output_tokens: r.try_get("max_output_tokens").unwrap_or(None),
            extra_body: serde_json::from_str(&extra_body_str)
                .unwrap_or_else(|_| Value::Object(Default::default())),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
        };
        let _ = repo::insert(app, &p).await;
    }
}
