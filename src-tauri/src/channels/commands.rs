use super::{ChannelInfo, TelegramConfig};
use crate::agent::AgentState;
use crate::persist;
use serde_json::json;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn channel_list(state: State<'_, AgentState>) -> Result<Vec<ChannelInfo>, String> {
    let ch = state.channel.lock().await;
    Ok(ch.list_infos())
}

#[tauri::command]
pub async fn channel_get(
    state: State<'_, AgentState>,
    kind: String,
) -> Result<serde_json::Value, String> {
    let ch = state.channel.lock().await;
    match kind.as_str() {
        "telegram" => {
            let token = ch
                .config
                .telegram
                .as_ref()
                .map(|t| t.token.clone())
                .unwrap_or_default();
            let allowed_ids = ch
                .config
                .telegram
                .as_ref()
                .map(|t| t.allowed_ids.clone())
                .unwrap_or_default();
            Ok(json!({
                "kind": "telegram",
                "token": token,
                "allowed_ids": allowed_ids,
                "enabled": ch.config.is_kind_enabled("telegram") && ch.is_telegram_running(),
            }))
        }
        other => {
            let draft = ch.config.drafts.get(other).cloned().unwrap_or_default();
            Ok(json!({
                "kind": other,
                "token": draft.token,
                "webhook": draft.webhook,
                "notes": draft.notes,
                "extra": draft.extra,
                "enabled": false,
            }))
        }
    }
}

#[tauri::command]
pub async fn channel_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    kind: String,
    token: String,
    allowed_ids: Option<Vec<String>>,
    webhook: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    match kind.as_str() {
        "telegram" => {
            ch.config.telegram = Some(TelegramConfig {
                token,
                allowed_ids: allowed_ids.unwrap_or_default(),
            });
        }
        other => {
            if !super::known_kinds().iter().any(|(k, _, _, _)| *k == other) {
                return Err(format!("未知渠道: {other}"));
            }
            let entry = ch.config.drafts.entry(other.to_string()).or_default();
            entry.token = token;
            if let Some(w) = webhook {
                entry.webhook = w;
            }
            if let Some(n) = notes {
                entry.notes = n;
            }
        }
    }
    persist::save_channel_config(&app, &ch.config);
    Ok(())
}

#[tauri::command]
pub async fn channel_enable(
    app: AppHandle,
    state: State<'_, AgentState>,
    kind: String,
) -> Result<Vec<ChannelInfo>, String> {
    let mut ch = state.channel.lock().await;
    super::enable_kind(&mut ch, app.clone(), &kind).await?;
    persist::save_channel_config(&app, &ch.config);
    Ok(ch.list_infos())
}

#[tauri::command]
pub async fn channel_disable(
    app: AppHandle,
    state: State<'_, AgentState>,
    kind: String,
) -> Result<Vec<ChannelInfo>, String> {
    let mut ch = state.channel.lock().await;
    super::disable_kind(&mut ch, &kind).await?;
    persist::save_channel_config(&app, &ch.config);
    Ok(ch.list_infos())
}

#[tauri::command]
pub async fn channel_telegram_get(
    state: State<'_, AgentState>,
) -> Result<serde_json::Value, String> {
    channel_get(state, "telegram".into()).await
}

#[tauri::command]
pub async fn channel_telegram_set(
    app: AppHandle,
    state: State<'_, AgentState>,
    token: String,
    allowed_ids: Vec<String>,
) -> Result<(), String> {
    channel_update(app, state, "telegram".into(), token, Some(allowed_ids), None, None).await
}

#[tauri::command]
pub async fn channel_telegram_start(
    app: AppHandle,
    state: State<'_, AgentState>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    super::enable_kind(&mut ch, app.clone(), "telegram").await?;
    persist::save_channel_config(&app, &ch.config);
    Ok(())
}

#[tauri::command]
pub async fn channel_telegram_stop(
    app: AppHandle,
    state: State<'_, AgentState>,
) -> Result<(), String> {
    let mut ch = state.channel.lock().await;
    super::disable_kind(&mut ch, "telegram").await?;
    persist::save_channel_config(&app, &ch.config);
    Ok(())
}
#[allow(dead_code)]
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("channels")
        .invoke_handler(tauri::generate_handler![
            channel_list,
            channel_get,
            channel_update,
            channel_enable,
            channel_disable,
            channel_telegram_get,
            channel_telegram_set,
            channel_telegram_start,
            channel_telegram_stop,
        ])
        .build()
}
