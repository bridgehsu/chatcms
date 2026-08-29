//! 意图规则 Tauri 命令。

use tauri::AppHandle;

use super::repository::IntentRuleRecord;
use super::service;

#[tauri::command]
pub async fn intent_rule_list(app: AppHandle) -> Result<Vec<IntentRuleRecord>, String> {
    Ok(service::list(&app).await)
}

#[tauri::command]
pub async fn intent_rule_update(
    app: AppHandle,
    id: String,
    keywords: Vec<String>,
    weight: f32,
    enabled: bool,
) -> Result<IntentRuleRecord, String> {
    service::update(&app, id, keywords, weight, enabled).await
}

#[tauri::command]
pub async fn intent_rule_reset_defaults(app: AppHandle) -> Result<Vec<IntentRuleRecord>, String> {
    service::reset_defaults(&app).await
}

#[tauri::command]
pub async fn intent_rule_reset_one(app: AppHandle, id: String) -> Result<IntentRuleRecord, String> {
    service::reset_one(&app, id).await
}
