//! 意图规则业务：种子、列表、更新、恢复默认、刷新缓存。

use tauri::AppHandle;

use super::cache;
use super::intent_result::IntentKind;
use super::repository::{self as repo, IntentRuleRecord};
use super::rules;

/// 空表时写入内置默认，并刷新内存缓存。
pub async fn ensure_seeded(app: &AppHandle) {
    if repo::count(app).await == 0 {
        repo::insert_seed(app, &rules::defaults()).await;
    }
    refresh_cache(app).await;
}

async fn refresh_cache(app: &AppHandle) {
    let rules = repo::load_rules(app).await;
    if rules.is_empty() {
        cache::refresh(rules::defaults());
    } else {
        cache::refresh(rules);
    }
}

pub async fn list(app: &AppHandle) -> Vec<IntentRuleRecord> {
    ensure_seeded(app).await;
    repo::load_all(app).await
}

pub async fn update(
    app: &AppHandle,
    id: String,
    keywords: Vec<String>,
    weight: f32,
    enabled: bool,
) -> Result<IntentRuleRecord, String> {
    ensure_seeded(app).await;
    let mut rec = repo::get_by_id(app, &id)
        .await
        .ok_or_else(|| format!("intent rule not found: {id}"))?;

    let cleaned: Vec<String> = keywords
        .into_iter()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    if cleaned.is_empty() {
        return Err("keywords must not be empty".into());
    }
    if !(0.01..=1.0).contains(&weight) {
        return Err("weight must be between 0.01 and 1.0".into());
    }

    rec.keywords = cleaned;
    rec.weight = weight;
    rec.enabled = enabled;
    repo::save(app, &rec).await?;
    refresh_cache(app).await;

    repo::get_by_id(app, &id)
        .await
        .ok_or_else(|| format!("intent rule missing after update: {id}"))
}

/// 将全部规则恢复为内置默认。
pub async fn reset_defaults(app: &AppHandle) -> Result<Vec<IntentRuleRecord>, String> {
    repo::delete_all(app).await;
    repo::insert_seed(app, &rules::defaults()).await;
    refresh_cache(app).await;
    Ok(repo::load_all(app).await)
}

/// 将单条规则恢复为内置默认。
pub async fn reset_one(app: &AppHandle, id: String) -> Result<IntentRuleRecord, String> {
    ensure_seeded(app).await;
    let rec = repo::get_by_id(app, &id)
        .await
        .ok_or_else(|| format!("intent rule not found: {id}"))?;
    let kind = IntentKind::parse(&rec.kind).ok_or_else(|| format!("invalid kind: {}", rec.kind))?;
    let def = rules::default_for(kind).ok_or_else(|| format!("no default for kind: {}", rec.kind))?;

    let mut next = rec;
    next.keywords = def.keywords;
    next.weight = def.weight;
    next.enabled = def.enabled;
    repo::save(app, &next).await?;
    refresh_cache(app).await;

    repo::get_by_id(app, &id)
        .await
        .ok_or_else(|| format!("intent rule missing after reset: {id}"))
}
