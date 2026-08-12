use super::{ExportResult, KnowledgeEntry, KnowledgeSiteProfile, PublicFeed};
use crate::agent::AgentState;
use crate::persist;
use tauri::{AppHandle, State};

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
    let entry = KnowledgeEntry::new(
        title,
        description,
        content,
        tags,
        visibility.unwrap_or_else(|| "private".into()),
        kind.unwrap_or_else(|| "note".into()),
        slug.unwrap_or_default(),
    );
    {
        let mut entries = state.knowledge.lock().unwrap();
        entries.push(entry.clone());
    }
    persist::save_knowledge_entry(&app, &entry).await;
    Ok(entry)
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
    let title = title.trim().to_string();
    let content = content.trim().to_string();
    if title.is_empty() {
        return Err("标题不能为空".into());
    }
    if content.is_empty() {
        return Err("内容不能为空".into());
    }
    let out = {
        let mut entries = state.knowledge.lock().unwrap();
        let entry = entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or_else(|| "条目不存在".to_string())?;
        entry.title = title;
        entry.description = description.trim().to_string();
        entry.content = content;
        entry.tags = tags;
        if let Some(v) = visibility {
            entry.visibility = if v.trim().eq_ignore_ascii_case("public") {
                "public".into()
            } else {
                "private".into()
            };
        }
        if let Some(k) = kind {
            entry.kind = match k.trim().to_lowercase().as_str() {
                "doc" => "doc".into(),
                "faq" => "faq".into(),
                _ => "note".into(),
            };
        }
        if let Some(s) = slug {
            let s = s.trim();
            entry.slug = if s.is_empty() {
                if entry.visibility == "public" {
                    super::normalize_slug(&entry.title)
                } else {
                    String::new()
                }
            } else {
                super::normalize_slug(s)
            };
        }
        entry.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        entry.clone()
    };
    persist::save_knowledge_entry(&app, &out).await;
    Ok(out)
}

#[tauri::command]
pub async fn knowledge_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    id: String,
) -> Result<(), String> {
    {
        let mut entries = state.knowledge.lock().unwrap();
        entries.retain(|e| e.id != id);
    }
    persist::delete_knowledge_entry(&app, &id).await;
    Ok(())
}

#[tauri::command]
pub async fn knowledge_site_profile_get(app: AppHandle) -> KnowledgeSiteProfile {
    persist::load_knowledge_site_profile(&app).await
}

#[tauri::command]
pub async fn knowledge_site_profile_set(
    app: AppHandle,
    handle: String,
    display_name: String,
    bio: String,
) -> Result<KnowledgeSiteProfile, String> {
    let handle = handle.trim().to_string();
    if handle.is_empty() {
        return Err("handle 不能为空".into());
    }
    if !handle
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("handle 仅允许字母数字与 - _".into());
    }
    let profile = KnowledgeSiteProfile {
        handle,
        display_name: display_name.trim().to_string(),
        bio: bio.trim().to_string(),
    };
    persist::save_knowledge_site_profile(&app, &profile).await;
    Ok(profile)
}

#[tauri::command]
pub fn knowledge_public_feed(app: AppHandle, state: State<'_, AgentState>) -> PublicFeed {
    let profile = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current()
            .block_on(persist::load_knowledge_site_profile(&app))
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
            .block_on(persist::load_knowledge_site_profile(&app))
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
