use std::collections::HashMap;

use tauri::AppHandle;
use uuid::Uuid;

use super::{
    BridgePlatform, BridgeScript, MediaPlatform, MediaPlatformPage, MediaPlatformPageItem,
    PublishScript, PublishScriptView, now_ms, normalize_kind, normalize_region, script_view,
};
use super::multipost_catalog::MULTIPOST_CATALOG;
use super::repository as repo;

/// 启动时：从旧 chatcms.json 迁入 SQLite，再按 MultiPost 目录补齐平台。
pub async fn migrate_and_seed(app: &AppHandle) {
    repo::migrate_from_legacy_store(app).await;
    sync_multipost_catalog(app).await;
}

/// 按 code 合并 MultiPost 全量目录：保留已有 id/enabled/notes，补齐缺失并刷新元数据。
async fn sync_multipost_catalog(app: &AppHandle) {
    let mut list = repo::load_platforms_async(app).await;
    let ts = now_ms();
    let mut index: HashMap<String, usize> = list
        .iter()
        .enumerate()
        .map(|(i, p)| (p.code.clone(), i))
        .collect();
    let mut changed = false;
    let mut inserted = 0usize;
    let mut refreshed = 0usize;

    for entry in MULTIPOST_CATALOG {
        let code = entry.code.to_string();
        let region = normalize_region(entry.region);
        if let Some(&idx) = index.get(&code) {
            let p = &mut list[idx];
            let mut dirty = false;
            if p.name != entry.name {
                p.name = entry.name.into();
                dirty = true;
            }
            if p.kind != entry.kind {
                p.kind = entry.kind.into();
                dirty = true;
            }
            if p.region != region {
                p.region = region.clone();
                dirty = true;
            }
            if p.inject_url != entry.inject_url {
                p.inject_url = entry.inject_url.into();
                dirty = true;
            }
            if p.home_url != entry.home_url {
                p.home_url = entry.home_url.into();
                dirty = true;
            }
            if dirty {
                p.updated_at = ts;
                changed = true;
                refreshed += 1;
            }
        } else {
            let platform = MediaPlatform {
                id: Uuid::new_v4().to_string(),
                code: code.clone(),
                name: entry.name.into(),
                kind: entry.kind.into(),
                inject_url: entry.inject_url.into(),
                home_url: entry.home_url.into(),
                enabled: true,
                notes: String::new(),
                region,
                updated_at: ts,
            };
            index.insert(code, list.len());
            list.push(platform);
            changed = true;
            inserted += 1;
        }
    }

    if !changed {
        return;
    }
    if let Err(e) = repo::save_platforms_async(app, &list).await {
        log::warn!(target: "chatcms_lib::medias", "sync MultiPost catalog failed: {e}");
        return;
    }
    log::info!(
        target: "chatcms_lib::medias",
        "MultiPost catalog synced: +{inserted} inserted, {refreshed} refreshed, total {}",
        list.len()
    );
}

pub fn ensure_seeded(app: &AppHandle) {
    // 同步路径：仅当库完全为空时写入目录（正常启动已由 migrate_and_seed 覆盖）
    let platforms = repo::load_platforms(app);
    if !platforms.is_empty() {
        return;
    }
    let ts = now_ms();
    let list: Vec<MediaPlatform> = MULTIPOST_CATALOG
        .iter()
        .map(|entry| MediaPlatform {
            id: Uuid::new_v4().to_string(),
            code: entry.code.into(),
            name: entry.name.into(),
            kind: entry.kind.into(),
            inject_url: entry.inject_url.into(),
            home_url: entry.home_url.into(),
            enabled: true,
            notes: String::new(),
            region: normalize_region(entry.region),
            updated_at: ts,
        })
        .collect();
    repo::save_platforms(app, &list);
}

pub fn list_platforms(app: &AppHandle) -> Vec<MediaPlatform> {
    ensure_seeded(app);
    let mut list = repo::load_platforms(app);
    list.sort_by(|a, b| {
        b.updated_at
            .cmp(&a.updated_at)
            .then_with(|| a.name.cmp(&b.name))
    });
    list
}

pub fn list_platforms_page(
    app: &AppHandle,
    query: Option<String>,
    kind: Option<String>,
    page: u32,
    page_size: u32,
) -> MediaPlatformPage {
    ensure_seeded(app);
    let page = page.max(1);
    let page_size = page_size.clamp(1, 100);
    let q = query
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());
    let kind_filter = kind
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty() && s != "all");

    let mut list = list_platforms(app);
    list.retain(|p| {
        if let Some(ref k) = kind_filter {
            if p.kind != *k {
                return false;
            }
        }
        if let Some(ref needle) = q {
            let hay = format!(
                "{} {} {} {} {}",
                p.name, p.code, p.inject_url, p.home_url, p.notes
            )
            .to_lowercase();
            if !hay.contains(needle) {
                return false;
            }
        }
        true
    });

    let total = list.len() as u64;
    let total_pages = if total == 0 {
        1
    } else {
        ((total + page_size as u64 - 1) / page_size as u64) as u32
    };
    let page = page.min(total_pages).max(1);
    let start = ((page - 1) as usize).saturating_mul(page_size as usize);
    let page_slice: Vec<MediaPlatform> = if start >= list.len() {
        vec![]
    } else {
        list.into_iter()
            .skip(start)
            .take(page_size as usize)
            .collect()
    };

    let publish_scripts = repo::load_publish_scripts(app);
    let collect_scripts = repo::load_collect_scripts(app);
    let items = page_slice
        .into_iter()
        .map(|platform| {
            let (script_is_published, script_has_unpublished_draft, script_published_version) =
                match publish_scripts.iter().find(|s| s.platform_id == platform.id) {
                    Some(s) => {
                        let v = script_view(s.clone());
                        (v.is_published, v.has_unpublished_draft, v.script.published_version)
                    }
                    None => (false, false, 0),
                };
            let (
                collect_script_is_published,
                collect_script_has_unpublished_draft,
                collect_script_published_version,
            ) = match collect_scripts.iter().find(|s| s.platform_id == platform.id) {
                Some(s) => {
                    let v = script_view(s.clone());
                    (v.is_published, v.has_unpublished_draft, v.script.published_version)
                }
                None => (false, false, 0),
            };
            MediaPlatformPageItem {
                platform,
                script_is_published,
                script_has_unpublished_draft,
                script_published_version,
                collect_script_is_published,
                collect_script_has_unpublished_draft,
                collect_script_published_version,
            }
        })
        .collect();

    MediaPlatformPage { items, total, page, page_size }
}

pub fn get_platform(app: &AppHandle, id: &str) -> Option<MediaPlatform> {
    ensure_seeded(app);
    repo::load_platforms(app).into_iter().find(|p| p.id == id)
}

pub fn upsert_platform(
    app: &AppHandle,
    id: Option<String>,
    code: String,
    name: String,
    kind: String,
    inject_url: String,
    home_url: String,
    enabled: bool,
    notes: String,
    region: Option<String>,
) -> Result<MediaPlatform, String> {
    ensure_seeded(app);
    let kind = normalize_kind(&kind)?;
    let region = normalize_region(region.as_deref().unwrap_or("cn"));
    let code = code.trim().to_uppercase();
    let name = name.trim().to_string();
    if code.is_empty() {
        return Err("编码不能为空".into());
    }
    if name.is_empty() {
        return Err("名称不能为空".into());
    }

    let mut list = repo::load_platforms(app);
    let ts = now_ms();

    if let Some(pid) = id.filter(|s| !s.trim().is_empty()) {
        if list.iter().any(|p| p.code == code && p.id != pid) {
            return Err(format!("编码「{code}」已被占用"));
        }
        let Some(item) = list.iter_mut().find(|p| p.id == pid) else {
            return Err("平台不存在".into());
        };
        item.code = code;
        item.name = name;
        item.kind = kind;
        item.inject_url = inject_url.trim().to_string();
        item.home_url = home_url.trim().to_string();
        item.enabled = enabled;
        item.notes = notes.trim().to_string();
        item.region = region;
        item.updated_at = ts;
        let updated = item.clone();
        repo::save_platforms(app, &list);
        Ok(updated)
    } else {
        if list.iter().any(|p| p.code == code) {
            return Err(format!("编码「{code}」已存在"));
        }
        let platform = MediaPlatform {
            id: Uuid::new_v4().to_string(),
            code,
            name,
            kind,
            inject_url: inject_url.trim().to_string(),
            home_url: home_url.trim().to_string(),
            enabled,
            notes: notes.trim().to_string(),
            region,
            updated_at: ts,
        };
        list.insert(0, platform.clone());
        repo::save_platforms(app, &list);
        Ok(platform)
    }
}

pub fn set_platform_enabled(app: &AppHandle, id: String, enabled: bool) -> Result<MediaPlatform, String> {
    ensure_seeded(app);
    let mut list = repo::load_platforms(app);
    let Some(item) = list.iter_mut().find(|p| p.id == id) else {
        return Err("平台不存在".into());
    };
    item.enabled = enabled;
    item.updated_at = now_ms();
    let updated = item.clone();
    repo::save_platforms(app, &list);
    Ok(updated)
}

pub fn remove_platform(app: &AppHandle, id: String) -> Result<(), String> {
    ensure_seeded(app);
    let mut list = repo::load_platforms(app);
    let before = list.len();
    list.retain(|p| p.id != id);
    if list.len() == before {
        return Err("平台不存在".into());
    }
    repo::save_platforms(app, &list);
    let mut scripts = repo::load_publish_scripts(app);
    scripts.retain(|s| s.platform_id != id);
    repo::save_publish_scripts(app, &scripts);
    let mut collect = repo::load_collect_scripts(app);
    collect.retain(|s| s.platform_id != id);
    repo::save_collect_scripts(app, &collect);
    Ok(())
}

pub fn list_scripts(app: &AppHandle, platform_id: Option<String>) -> Vec<PublishScriptView> {
    ensure_seeded(app);
    let mut list = repo::load_publish_scripts(app);
    if let Some(pid) = platform_id.filter(|s| !s.is_empty()) {
        list.retain(|s| s.platform_id == pid);
    }
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list.into_iter().map(script_view).collect()
}

pub fn get_or_create_script(app: &AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let platform = get_platform(app, &platform_id).ok_or("平台不存在")?;
    let mut list = repo::load_publish_scripts(app);
    if let Some(existing) = list.iter().find(|s| s.platform_id == platform_id) {
        return Ok(script_view(existing.clone()));
    }
    let script = PublishScript {
        id: Uuid::new_v4().to_string(),
        platform_id: platform_id.clone(),
        kind: platform.kind.clone(),
        draft_script: String::new(),
        published_script: String::new(),
        published_version: 0,
        match_url: String::new(),
        changelog: String::new(),
        updated_at: now_ms(),
    };
    list.insert(0, script.clone());
    repo::save_publish_scripts(app, &list);
    Ok(script_view(script))
}

pub fn save_script_draft(
    app: &AppHandle,
    platform_id: String,
    draft_script: String,
    match_url: String,
    changelog: String,
) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let platform = get_platform(app, &platform_id).ok_or("平台不存在")?;
    let mut list = repo::load_publish_scripts(app);
    let ts = now_ms();
    if let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) {
        item.kind = platform.kind.clone();
        item.draft_script = draft_script;
        item.match_url = match_url.trim().to_string();
        item.changelog = changelog.trim().to_string();
        item.updated_at = ts;
        let updated = item.clone();
        repo::save_publish_scripts(app, &list);
        return Ok(script_view(updated));
    }
    let script = PublishScript {
        id: Uuid::new_v4().to_string(),
        platform_id,
        kind: platform.kind,
        draft_script,
        published_script: String::new(),
        published_version: 0,
        match_url: match_url.trim().to_string(),
        changelog: changelog.trim().to_string(),
        updated_at: ts,
    };
    list.insert(0, script.clone());
    repo::save_publish_scripts(app, &list);
    Ok(script_view(script))
}

pub fn publish_script(app: &AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = repo::load_publish_scripts(app);
    let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) else {
        return Err("脚本不存在，请先保存草稿".into());
    };
    if item.draft_script.trim().is_empty() {
        return Err("草稿为空，无法发布".into());
    }
    item.published_script = item.draft_script.clone();
    item.published_version = item.published_version.saturating_add(1);
    item.updated_at = now_ms();
    let updated = item.clone();
    repo::save_publish_scripts(app, &list);
    Ok(script_view(updated))
}

pub fn discard_script_draft(app: &AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = repo::load_publish_scripts(app);
    let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) else {
        return Err("脚本不存在".into());
    };
    item.draft_script = item.published_script.clone();
    item.updated_at = now_ms();
    let updated = item.clone();
    repo::save_publish_scripts(app, &list);
    Ok(script_view(updated))
}

pub fn bridge_list_platforms(app: &AppHandle) -> Vec<BridgePlatform> {
    ensure_seeded(app);
    let scripts = repo::load_publish_scripts(app);
    let collect_scripts = repo::load_collect_scripts(app);
    list_platforms(app)
        .into_iter()
        .filter(|p| p.enabled)
        .map(|p| {
            let script = scripts.iter().find(|s| s.platform_id == p.id);
            let collect = collect_scripts.iter().find(|s| s.platform_id == p.id);
            BridgePlatform {
                id: p.id,
                code: p.code,
                name: p.name,
                kind: p.kind,
                inject_url: p.inject_url,
                home_url: p.home_url,
                region: p.region,
                has_script: script
                    .map(|s| s.published_version > 0 && !s.published_script.is_empty())
                    .unwrap_or(false),
                script_version: script.map(|s| s.published_version).unwrap_or(0),
                has_collect_script: collect
                    .map(|s| s.published_version > 0 && !s.published_script.is_empty())
                    .unwrap_or(false),
                collect_script_version: collect.map(|s| s.published_version).unwrap_or(0),
            }
        })
        .collect()
}

pub fn bridge_get_script(app: &AppHandle, code: &str) -> Result<BridgeScript, String> {
    bridge_get_script_of(app, code, false)
}

pub fn bridge_get_collect_script(app: &AppHandle, code: &str) -> Result<BridgeScript, String> {
    bridge_get_script_of(app, code, true)
}

fn bridge_get_script_of(app: &AppHandle, code: &str, collect: bool) -> Result<BridgeScript, String> {
    ensure_seeded(app);
    let code = code.trim();
    let platform = list_platforms(app)
        .into_iter()
        .find(|p| p.code == code || p.id == code)
        .ok_or_else(|| "平台不存在".to_string())?;
    if !platform.enabled {
        return Err("平台未启用".into());
    }
    let script = if collect {
        repo::load_collect_scripts(app)
    } else {
        repo::load_publish_scripts(app)
    }
    .into_iter()
    .find(|s| s.platform_id == platform.id)
    .ok_or_else(|| {
        if collect { "暂无采集脚本".to_string() } else { "暂无填表脚本".to_string() }
    })?;
    if script.published_version == 0 || script.published_script.trim().is_empty() {
        return Err(if collect {
            "暂无已发布的采集脚本".into()
        } else {
            "暂无已发布的填表脚本".into()
        });
    }
    Ok(BridgeScript {
        platform_id: platform.id,
        code: platform.code,
        kind: platform.kind,
        script: script.published_script,
        version: script.published_version,
        match_url: script.match_url,
    })
}

pub fn list_collect_scripts(app: &AppHandle, platform_id: Option<String>) -> Vec<PublishScriptView> {
    ensure_seeded(app);
    let mut list = repo::load_collect_scripts(app);
    if let Some(pid) = platform_id.filter(|s| !s.is_empty()) {
        list.retain(|s| s.platform_id == pid);
    }
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list.into_iter().map(script_view).collect()
}

pub fn get_or_create_collect_script(app: &AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let platform = get_platform(app, &platform_id).ok_or("平台不存在")?;
    let mut list = repo::load_collect_scripts(app);
    if let Some(existing) = list.iter().find(|s| s.platform_id == platform_id) {
        return Ok(script_view(existing.clone()));
    }
    let script = PublishScript {
        id: Uuid::new_v4().to_string(),
        platform_id: platform_id.clone(),
        kind: platform.kind.clone(),
        draft_script: String::new(),
        published_script: String::new(),
        published_version: 0,
        match_url: String::new(),
        changelog: String::new(),
        updated_at: now_ms(),
    };
    list.insert(0, script.clone());
    repo::save_collect_scripts(app, &list);
    Ok(script_view(script))
}

pub fn save_collect_script_draft(
    app: &AppHandle,
    platform_id: String,
    draft_script: String,
    match_url: String,
    changelog: String,
) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let platform = get_platform(app, &platform_id).ok_or("平台不存在")?;
    let mut list = repo::load_collect_scripts(app);
    let ts = now_ms();
    if let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) {
        item.kind = platform.kind.clone();
        item.draft_script = draft_script;
        item.match_url = match_url.trim().to_string();
        item.changelog = changelog.trim().to_string();
        item.updated_at = ts;
        let updated = item.clone();
        repo::save_collect_scripts(app, &list);
        return Ok(script_view(updated));
    }
    let script = PublishScript {
        id: Uuid::new_v4().to_string(),
        platform_id,
        kind: platform.kind,
        draft_script,
        published_script: String::new(),
        published_version: 0,
        match_url: match_url.trim().to_string(),
        changelog: changelog.trim().to_string(),
        updated_at: ts,
    };
    list.insert(0, script.clone());
    repo::save_collect_scripts(app, &list);
    Ok(script_view(script))
}

pub fn publish_collect_script(app: &AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = repo::load_collect_scripts(app);
    let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) else {
        return Err("脚本不存在，请先保存草稿".into());
    };
    if item.draft_script.trim().is_empty() {
        return Err("草稿为空，无法发布".into());
    }
    item.published_script = item.draft_script.clone();
    item.published_version = item.published_version.saturating_add(1);
    item.updated_at = now_ms();
    let updated = item.clone();
    repo::save_collect_scripts(app, &list);
    Ok(script_view(updated))
}

pub fn discard_collect_script_draft(app: &AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = repo::load_collect_scripts(app);
    let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) else {
        return Err("脚本不存在".into());
    };
    item.draft_script = item.published_script.clone();
    item.updated_at = now_ms();
    let updated = item.clone();
    repo::save_collect_scripts(app, &list);
    Ok(script_view(updated))
}
