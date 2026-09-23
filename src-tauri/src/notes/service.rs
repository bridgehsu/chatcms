use tauri::AppHandle;

use super::repository as repo;
use super::{new_id, now_ms, CmsNote, CmsNoteGroup, NotesBundle};
use crate::agents::AgentState;
use crate::kbase::{self, KnowledgeEntry};

const CMS_NOTE_TAG: &str = "cms-note";

fn knowledge_slug(note_id: &str) -> String {
    format!("cms-note-{}", note_id.chars().take(12).collect::<String>())
}

fn sync_knowledge_memory(state: &AgentState, entry: &KnowledgeEntry) {
    let mut list = state.knowledge.lock().unwrap();
    if let Some(existing) = list.iter_mut().find(|e| e.id == entry.id) {
        *existing = entry.clone();
    } else {
        list.push(entry.clone());
    }
}

fn remove_knowledge_memory(state: &AgentState, id: &str) {
    state.knowledge.lock().unwrap().retain(|e| e.id != id);
}

async fn upsert_knowledge_bridge(
    app: &AppHandle,
    state: &AgentState,
    note: &CmsNote,
) -> Result<String, String> {
    let title = if note.title.trim().is_empty() {
        "无标题笔记".to_string()
    } else {
        note.title.trim().to_string()
    };
    let desc = format!("内容管理笔记 · {}", title);
    let tags = vec![CMS_NOTE_TAG.to_string(), format!("note:{}", note.id)];
    let slug = knowledge_slug(&note.id);
    let now = kbase::now_secs();

    let entry = if let Some(kid) = note.knowledge_id.as_ref().filter(|s| !s.is_empty()) {
        KnowledgeEntry {
            id: kid.clone(),
            title: title.clone(),
            description: desc,
            content: note.content.clone(),
            tags,
            visibility: "private".into(),
            kind: "note".into(),
            slug,
            created: now,
            updated: now,
        }
    } else {
        let mut e = KnowledgeEntry::new(
            title,
            desc,
            note.content.clone(),
            tags,
            "private".into(),
            "note".into(),
            slug,
        );
        e.updated = now;
        e
    };

    kbase::repository::save_entry(app, &entry).await;
    sync_knowledge_memory(state, &entry);
    Ok(entry.id)
}

async fn delete_knowledge_bridge(app: &AppHandle, state: &AgentState, knowledge_id: &str) {
    if knowledge_id.is_empty() {
        return;
    }
    kbase::repository::delete_entry(app, knowledge_id).await;
    remove_knowledge_memory(state, knowledge_id);
}

pub async fn list_bundle(app: &AppHandle) -> NotesBundle {
    NotesBundle {
        notes: repo::load_notes(app).await,
        groups: repo::load_groups(app).await,
    }
}

pub async fn create_note(
    app: &AppHandle,
    state: &AgentState,
    title: String,
    content: String,
    icon: Option<String>,
    group_id: Option<String>,
    source_session_id: Option<String>,
    source_session_title: Option<String>,
    source_message_id: Option<String>,
) -> Result<CmsNote, String> {
    let now = now_ms();
    let mut note = CmsNote {
        id: new_id(),
        title: title.trim().to_string(),
        content,
        icon: icon.unwrap_or_else(|| "📄".into()),
        group_id: group_id.filter(|s| !s.is_empty()),
        source_session_id: source_session_id.filter(|s| !s.is_empty()),
        source_session_title: source_session_title.filter(|s| !s.is_empty()),
        source_message_id: source_message_id.filter(|s| !s.is_empty()),
        knowledge_id: None,
        created_at: now,
        updated_at: now,
    };
    let kid = upsert_knowledge_bridge(app, state, &note).await?;
    note.knowledge_id = Some(kid);
    repo::save_note(app, &note).await?;
    Ok(note)
}

pub async fn update_note(
    app: &AppHandle,
    state: &AgentState,
    id: String,
    title: Option<String>,
    content: Option<String>,
    icon: Option<String>,
    group_id: Option<String>,
    source_session_id: Option<String>,
    source_session_title: Option<String>,
    source_message_id: Option<String>,
) -> Result<CmsNote, String> {
    let mut note = repo::get_note(app, &id)
        .await
        .ok_or_else(|| "笔记不存在".to_string())?;
    if let Some(t) = title {
        note.title = t.trim().to_string();
    }
    if let Some(c) = content {
        note.content = c;
    }
    if let Some(i) = icon {
        note.icon = i;
    }
    // Some("") → 清空分组；字段省略则不改
    if let Some(g) = group_id {
        note.group_id = if g.is_empty() { None } else { Some(g) };
    }
    if let Some(s) = source_session_id {
        note.source_session_id = if s.is_empty() { None } else { Some(s) };
    }
    if let Some(s) = source_session_title {
        note.source_session_title = if s.is_empty() { None } else { Some(s) };
    }
    if let Some(s) = source_message_id {
        note.source_message_id = if s.is_empty() { None } else { Some(s) };
    }
    note.updated_at = now_ms();
    let kid = upsert_knowledge_bridge(app, state, &note).await?;
    note.knowledge_id = Some(kid);
    repo::save_note(app, &note).await?;
    Ok(note)
}

pub async fn remove_note(app: &AppHandle, state: &AgentState, id: String) -> Result<(), String> {
    if let Some(note) = repo::get_note(app, &id).await {
        if let Some(kid) = note.knowledge_id {
            delete_knowledge_bridge(app, state, &kid).await;
        }
    }
    repo::soft_delete_note(app, &id).await
}

pub async fn create_group(app: &AppHandle, name: String) -> Result<CmsNoteGroup, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("分组名不能为空".into());
    }
    if name.chars().count() > 40 {
        return Err("分组名最多 40 字".into());
    }
    let now = now_ms();
    let g = CmsNoteGroup {
        id: new_id(),
        name,
        sort_order: repo::next_group_sort(app).await,
        created_at: now,
        updated_at: now,
    };
    repo::save_group(app, &g).await?;
    Ok(g)
}

pub async fn rename_group(app: &AppHandle, id: String, name: String) -> Result<CmsNoteGroup, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("分组名不能为空".into());
    }
    if name.chars().count() > 40 {
        return Err("分组名最多 40 字".into());
    }
    let groups = repo::load_groups(app).await;
    let mut g = groups
        .into_iter()
        .find(|x| x.id == id)
        .ok_or_else(|| "分组不存在".to_string())?;
    g.name = name;
    g.updated_at = now_ms();
    repo::save_group(app, &g).await?;
    Ok(g)
}

pub async fn delete_group(app: &AppHandle, id: String) -> Result<(), String> {
    let n = repo::count_notes_in_group(app, &id).await;
    if n > 0 {
        return Err(format!("该分组下还有 {n} 篇笔记，请先移出或删除"));
    }
    repo::soft_delete_group(app, &id).await
}

pub async fn notes_by_message(app: &AppHandle, message_id: String) -> Vec<CmsNote> {
    repo::list_by_message_id(app, &message_id).await
}

/// 从 localStorage 迁移包导入（仅当库为空时由前端触发）
pub async fn import_bundle(
    app: &AppHandle,
    state: &AgentState,
    notes: Vec<CmsNote>,
    groups: Vec<CmsNoteGroup>,
) -> Result<NotesBundle, String> {
    let existing = repo::count_notes(app).await;
    if existing > 0 {
        return Ok(list_bundle(app).await);
    }
    for g in &groups {
        repo::save_group(app, g).await?;
    }
    for mut n in notes {
        let kid = upsert_knowledge_bridge(app, state, &n).await?;
        n.knowledge_id = Some(kid);
        repo::save_note(app, &n).await?;
    }
    Ok(list_bundle(app).await)
}
