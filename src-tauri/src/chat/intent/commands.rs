//! 意图规则 Tauri 命令。

use tauri::AppHandle;

use super::eval::{self, EvalCase, EvalReport};
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

/// 内置意图评测 case bank。
#[tauri::command]
pub async fn intent_eval_cases() -> Result<Vec<EvalCase>, String> {
    Ok(eval::default_cases())
}

/// 跑意图离线评测；`cases` 为空则用内置样例。
#[tauri::command]
pub async fn intent_eval_run(cases: Option<Vec<EvalCase>>) -> Result<EvalReport, String> {
    Ok(eval::run_cases(cases))
}
