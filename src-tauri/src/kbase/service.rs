use tauri::AppHandle;

use super::{KnowledgeEntry, KnowledgeSiteProfile, normalize_slug};
use crate::agents::AgentState;
use super::repository as repo;

pub async fn add(
    app: &AppHandle,
    state: &AgentState,
    title: String,
    description: String,
    content: String,
    tags: Vec<String>,
    visibility: String,
    kind: String,
    slug: String,
) -> Result<KnowledgeEntry, String> {
    let entry = KnowledgeEntry::new(title, description, content, tags, visibility, kind, slug);
    {
        let mut entries = state.knowledge.lock().unwrap();
        entries.push(entry.clone());
    }
    repo::save_entry(app, &entry).await;
    Ok(entry)
}

pub async fn update(
    app: &AppHandle,
    state: &AgentState,
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
                    normalize_slug(&entry.title)
                } else {
                    String::new()
                }
            } else {
                normalize_slug(s)
            };
        }
        entry.updated = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        entry.clone()
    };
    repo::save_entry(app, &out).await;
    Ok(out)
}

pub async fn remove(app: &AppHandle, state: &AgentState, id: String) {
    {
        let mut entries = state.knowledge.lock().unwrap();
        entries.retain(|e| e.id != id);
    }
    repo::delete_entry(app, &id).await;
}

pub async fn get_site_profile(app: &AppHandle) -> KnowledgeSiteProfile {
    repo::load_site_profile(app).await
}

pub async fn set_site_profile(
    app: &AppHandle,
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
    repo::save_site_profile(app, &profile).await;
    Ok(profile)
}
