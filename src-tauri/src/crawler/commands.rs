use super::{CrawlerConfig, CrawlerStartRequest, CrawlerStatus, DataFileInfo, LogEntry};
use tauri::AppHandle;

#[tauri::command]
pub fn crawler_config_get(app: AppHandle) -> CrawlerConfig {
    super::load_config(&app)
}

#[tauri::command]
pub fn crawler_config_set(app: AppHandle, base_url: String) -> Result<CrawlerConfig, String> {
    let cfg = CrawlerConfig {
        base_url: base_url.trim().to_string(),
    };
    if cfg.base_url.is_empty() {
        return Err("base_url 不能为空".into());
    }
    if !(cfg.base_url.starts_with("http://") || cfg.base_url.starts_with("https://")) {
        return Err("base_url 需以 http:// 或 https:// 开头".into());
    }
    super::save_config(&app, &cfg);
    Ok(super::load_config(&app))
}

#[tauri::command]
pub async fn crawler_health(app: AppHandle) -> Result<String, String> {
    super::health(&app).await
}

#[tauri::command]
pub async fn crawler_start(
    app: AppHandle,
    request: CrawlerStartRequest,
) -> Result<CrawlerStatus, String> {
    if request.platform.trim().is_empty() {
        return Err("platform 不能为空".into());
    }
    super::start(&app, request).await
}

#[tauri::command]
pub async fn crawler_stop(app: AppHandle) -> Result<CrawlerStatus, String> {
    super::stop(&app).await
}

#[tauri::command]
pub async fn crawler_status(app: AppHandle) -> Result<CrawlerStatus, String> {
    super::status(&app).await
}

#[tauri::command]
pub async fn crawler_logs(
    app: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    super::logs(&app, limit.unwrap_or(200)).await
}

#[tauri::command]
pub async fn crawler_list_data(
    app: AppHandle,
    platform: Option<String>,
) -> Result<Vec<DataFileInfo>, String> {
    super::list_data_files(&app, platform).await
}
