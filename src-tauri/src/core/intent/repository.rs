//! 意图规则持久层。

use sqlx::Row;
use tauri::{AppHandle, Manager};

use super::intent_result::IntentKind;
use super::rules::Rule;
use crate::db::DbPool;

/// 对外 CRUD / 列表用的规则记录。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IntentRuleRecord {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub keywords: Vec<String>,
    pub weight: f32,
    pub enabled: bool,
    pub sort_order: i64,
    pub updated: i64,
}

fn pool(app: &AppHandle) -> sqlx::SqlitePool {
    app.state::<DbPool>().inner().0.clone()
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn row_to_record(r: sqlx::sqlite::SqliteRow) -> IntentRuleRecord {
    let kind_str: String = r.get("kind");
    let kind = IntentKind::parse(&kind_str).unwrap_or(IntentKind::Unknown);
    let keywords_raw: String = r.get("keywords");
    let keywords: Vec<String> =
        serde_json::from_str(&keywords_raw).unwrap_or_default();
    IntentRuleRecord {
        id: r.get("id"),
        kind: kind_str,
        label: kind.label_zh().to_string(),
        keywords,
        weight: r.get::<f64, _>("weight") as f32,
        enabled: r.get::<i64, _>("enabled") != 0,
        sort_order: r.get("sort_order"),
        updated: r.get("updated"),
    }
}

fn record_to_rule(rec: &IntentRuleRecord) -> Option<Rule> {
    let kind = IntentKind::parse(&rec.kind)?;
    if kind == IntentKind::Unknown {
        return None;
    }
    Some(Rule {
        kind,
        keywords: rec.keywords.clone(),
        weight: rec.weight,
        enabled: rec.enabled,
    })
}

pub async fn count(app: &AppHandle) -> i64 {
    let p = pool(app);
    sqlx::query_scalar("SELECT COUNT(*) FROM intent_rule")
        .fetch_one(&p)
        .await
        .unwrap_or(0)
}

pub async fn load_all(app: &AppHandle) -> Vec<IntentRuleRecord> {
    let p = pool(app);
    let rows = sqlx::query(
        "SELECT id, kind, keywords, weight, enabled, sort_order, updated
         FROM intent_rule
         ORDER BY sort_order ASC, kind ASC",
    )
    .fetch_all(&p)
    .await
    .unwrap_or_default();

    rows.into_iter().map(row_to_record).collect()
}

pub async fn load_rules(app: &AppHandle) -> Vec<Rule> {
    load_all(app)
        .await
        .iter()
        .filter_map(record_to_rule)
        .collect()
}

pub async fn insert_seed(app: &AppHandle, rules: &[Rule]) {
    let p = pool(app);
    let updated = now_ms();
    for (i, rule) in rules.iter().enumerate() {
        let id = rule.kind.as_str().to_string();
        let keywords = serde_json::to_string(&rule.keywords).unwrap_or_else(|_| "[]".into());
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO intent_rule
             (id, kind, keywords, weight, enabled, sort_order, updated)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(rule.kind.as_str())
        .bind(&keywords)
        .bind(rule.weight as f64)
        .bind(rule.enabled as i64)
        .bind(i as i64)
        .bind(updated)
        .execute(&p)
        .await;
    }
}

pub async fn save(app: &AppHandle, rec: &IntentRuleRecord) -> Result<(), String> {
    let p = pool(app);
    let keywords = serde_json::to_string(&rec.keywords).map_err(|e| e.to_string())?;
    let updated = now_ms();
    sqlx::query(
        "UPDATE intent_rule
         SET keywords = ?, weight = ?, enabled = ?, sort_order = ?, updated = ?
         WHERE id = ?",
    )
    .bind(&keywords)
    .bind(rec.weight as f64)
    .bind(rec.enabled as i64)
    .bind(rec.sort_order)
    .bind(updated)
    .bind(&rec.id)
    .execute(&p)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn delete_all(app: &AppHandle) {
    let p = pool(app);
    let _ = sqlx::query("DELETE FROM intent_rule").execute(&p).await;
}

pub async fn get_by_id(app: &AppHandle, id: &str) -> Option<IntentRuleRecord> {
    let p = pool(app);
    let row = sqlx::query(
        "SELECT id, kind, keywords, weight, enabled, sort_order, updated
         FROM intent_rule WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&p)
    .await
    .ok()
    .flatten()?;
    Some(row_to_record(row))
}
