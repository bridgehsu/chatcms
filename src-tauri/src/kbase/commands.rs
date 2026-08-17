use super::{ExportResult, KnowledgeEntry, KnowledgeSiteProfile, PublicFeed};
use crate::agent::AgentState;
use tauri::{AppHandle, State};

use super::service;

#[tauri::command]
pub fn knowledge_list(state: State<'_, AgentState>) -> Vec<KnowledgeEntry> {
    state.knowledge.lock().unwrap().clone()
}

#[tauri::command]
pub async fn knowledge_add(
    app: AppHandle,
    state: State<'_, AgentState>,
    title: String,
    description: String,
    content: String,
    tags: Vec<String>,
    visibility: Option<String>,
    kind: Option<String>,
    slug: Option<String>,
) -> Result<KnowledgeEntry, String> {
    service::add(
        &app,
        &state,
        title,
        description,
        content,
        tags,
        visibility.unwrap_or_else(|| "private".into()),
        kind.unwrap_or_else(|| "note".into()),
        slug.unwrap_or_default(),
    )
    .await
}

#[tauri::command]
pub async fn knowledge_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
    title: String,
    description: String,
    content: String,
    tags: Vec<String>,
    visibility: Option<String>,
    kind: Option<String>,
    slug: Option<String>,
) -> Result<KnowledgeEntry, String> {
    service::update(&app, &state, id, title, description, content, tags, visibility, kind, slug).await
}

#[tauri::command]
pub async fn knowledge_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    service::remove(&app, &state, id).await;
    Ok(())
}

#[tauri::command]
pub async fn knowledge_site_profile_get(app: AppHandle) -> KnowledgeSiteProfile {
    service::get_site_profile(&app).await
}

#[tauri::command]
pub async fn knowledge_site_profile_set(
    app: AppHandle,
    handle: String,
    display_name: String,
    bio: String,
) -> Result<KnowledgeSiteProfile, String> {
    service::set_site_profile(&app, handle, display_name, bio).await
}

#[tauri::command]
pub fn knowledge_public_feed(app: AppHandle, state: State<'_, AgentState>) -> PublicFeed {
    let profile = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current()
            .block_on(service::get_site_profile(&app))
    });
    let entries = state.knowledge.lock().unwrap().clone();
    super::build_feed(&profile, &entries)
}

#[tauri::command]
pub fn knowledge_export_public(
    app: AppHandle,
    state: State<'_, AgentState>,
    output_dir: String,
) -> Result<ExportResult, String> {
    let output_dir = output_dir.trim();
    if output_dir.is_empty() {
        return Err("请指定导出目录（chatcms.org/content）".into());
    }
    let profile = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current()
            .block_on(service::get_site_profile(&app))
    });
    let entries = state.knowledge.lock().unwrap().clone();
    super::export_public_site(&profile, &entries, output_dir)
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::<tauri::Wry>::new("knowledge")
        .invoke_handler(tauri::generate_handler![
            knowledge_list,
            knowledge_add,
            knowledge_update,
            knowledge_remove,
            knowledge_site_profile_get,
            knowledge_site_profile_set,
            knowledge_public_feed,
            knowledge_export_public,
        ])
        .build()
}
