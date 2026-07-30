use super::PublishBridge;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn publish_to_browser(
    app: AppHandle,
    bridge: State<'_, PublishBridge>,
    sync_data: serde_json::Value,
) -> Result<String, String> {
    super::prepare_and_open(&bridge, &app, sync_data).await
}

#[tauri::command]
pub fn publish_media_base() -> String {
    PublishBridge::base_url()
}
