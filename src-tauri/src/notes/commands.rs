use tauri::{AppHandle, State};

use super::{CmsNote, CmsNoteGroup, NotesBundle};
use crate::agents::AgentState;

#[tauri::command]
pub async fn notes_list(app: AppHandle) -> NotesBundle {
    super::service::list_bundle(&app).await
}

#[tauri::command]
pub async fn notes_create(
    app: AppHandle,
    state: State<'_, AgentState>,
    title: String,
    content: String,
    icon: Option<String>,
    group_id: Option<String>,
    source_session_id: Option<String>,
    source_session_title: Option<String>,
    source_message_id: Option<String>,
) -> Result<CmsNote, String> {
    super::service::create_note(
        &app,
        &state,
        title,
        content,
        icon,
        group_id,
        source_session_id,
        source_session_title,
        source_message_id,
    )
    .await
}

#[tauri::command]
pub async fn notes_update(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    icon: Option<String>,
    group_id: Option<String>,
    source_session_id: Option<String>,
    source_session_title: Option<String>,
    source_message_id: Option<String>,
) -> Result<CmsNote, String> {
    super::service::update_note(
        &app,
        &state,
        id,
        title,
        content,
        icon,
        group_id,
        source_session_id,
        source_session_title,
        source_message_id,
    )
    .await
}

#[tauri::command]
pub async fn notes_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    super::service::remove_note(&app, &state, id).await
}

#[tauri::command]
pub async fn notes_group_create(app: AppHandle, name: String) -> Result<CmsNoteGroup, String> {
    super::service::create_group(&app, name).await
}

#[tauri::command]
pub async fn notes_group_rename(
    app: AppHandle,
    id: String,
    name: String,
) -> Result<CmsNoteGroup, String> {
    super::service::rename_group(&app, id, name).await
}

#[tauri::command]
pub async fn notes_group_delete(app: AppHandle, id: String) -> Result<(), String> {
    super::service::delete_group(&app, id).await
}

#[tauri::command]
pub async fn notes_by_message(app: AppHandle, message_id: String) -> Vec<CmsNote> {
    super::service::notes_by_message(&app, message_id).await
}

#[tauri::command]
pub async fn notes_import_legacy(
    app: AppHandle,
    state: State<'_, AgentState>,
    notes: Vec<CmsNote>,
    groups: Vec<CmsNoteGroup>,
) -> Result<NotesBundle, String> {
    super::service::import_bundle(&app, &state, notes, groups).await
}
