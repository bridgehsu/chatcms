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
) -> Result<ProviderProfile, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    let weight = weight.clamp(1, 4);
    let p = ProviderProfile {
        id: Uuid::new_v4().to_string(),
        name,
        kind,
        api_key,
        model,
        base_url,
        tier,
        weight,
        context_window,
        enabled: true,
        created: now_ms(),
        updated: now_ms(),
    };
    repo::insert(app, &p).await;
    Ok(p)
}

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
    p.updated = now_ms();
    repo::update(app, &p).await;
    Ok(p)
}

pub async fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    if repo::get(app, &id).await.is_none() {
        return Err("Profile 不存在".into());
    }
    repo::remove(app, &id).await;
    Ok(())
}

/// 从旧的 chatcms.json profiles 迁移到 SQLite（幂等）。
/// 仅在 model_profile 表为空时执行。
pub async fn migrate_from_legacy(app: &AppHandle, legacy_profiles: Vec<crate::config::ProviderProfile>) {
    let existing = repo::list(app).await;
    if !existing.is_empty() {
        return; // 已迁移，跳过
    }
    let now = now_ms();
    for (i, lp) in legacy_profiles.iter().enumerate() {
        let kind = match lp.kind {
            crate::config::ProviderKind::Anthropic => "anthropic",
            crate::config::ProviderKind::OpenAI => "openai",
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
        };
        repo::insert(app, &p).await;
    }
}
