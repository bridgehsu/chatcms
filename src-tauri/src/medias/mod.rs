//! 媒体管理：发布平台元数据 + 按类型独立的填表脚本（draft / published）。

pub mod commands;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaPlatform {
    pub id: String,
    /// 与扩展 SyncData / 账号侧对齐的稳定编码，如 DYNAMIC_REDNOTE
    pub code: String,
    pub name: String,
    /// dynamic | article | video
    pub kind: String,
    #[serde(default)]
    pub inject_url: String,
    #[serde(default)]
    pub home_url: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub notes: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishScript {
    pub id: String,
    pub platform_id: String,
    /// 与平台 kind 一致；脚本独立存储便于单独维护
    pub kind: String,
    #[serde(default)]
    pub draft_script: String,
    #[serde(default)]
    pub published_script: String,
    #[serde(default)]
    pub published_version: u32,
    #[serde(default)]
    pub match_url: String,
    #[serde(default)]
    pub changelog: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishScriptView {
    #[serde(flatten)]
    pub script: PublishScript,
    pub has_unpublished_draft: bool,
    pub is_published: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaPlatformPageItem {
    #[serde(flatten)]
    pub platform: MediaPlatform,
    pub script_is_published: bool,
    pub script_has_unpublished_draft: bool,
    pub script_published_version: u32,
    #[serde(default)]
    pub collect_script_is_published: bool,
    #[serde(default)]
    pub collect_script_has_unpublished_draft: bool,
    #[serde(default)]
    pub collect_script_published_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaPlatformPage {
    pub items: Vec<MediaPlatformPageItem>,
    pub total: u64,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgePlatform {
    pub id: String,
    pub code: String,
    pub name: String,
    pub kind: String,
    pub inject_url: String,
    pub home_url: String,
    pub has_script: bool,
    pub script_version: u32,
    #[serde(default)]
    pub has_collect_script: bool,
    #[serde(default)]
    pub collect_script_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeScript {
    pub platform_id: String,
    pub code: String,
    pub kind: String,
    pub script: String,
    pub version: u32,
    pub match_url: String,
}

fn default_true() -> bool {
    true
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn normalize_kind(kind: &str) -> Result<String, String> {
    let k = kind.trim().to_lowercase();
    match k.as_str() {
        "dynamic" | "article" | "video" => Ok(k),
        _ => Err("类型须为 dynamic / article / video".into()),
    }
}

/// 首次为空时写入内置预设（对齐扩展与桌面发布平台表）。
pub fn ensure_seeded(app: &AppHandle) {
    let platforms = crate::persist::load_media_platforms(app);
    if !platforms.is_empty() {
        return;
    }
    let ts = now_ms();
    let seed: Vec<(&str, &str, &str, &str, &str)> = vec![
        (
            "DYNAMIC_REDNOTE",
            "小红书",
            "dynamic",
            "https://creator.xiaohongshu.com/publish/publish?target=image",
            "https://creator.xiaohongshu.com/",
        ),
        (
            "DYNAMIC_DOUYIN",
            "抖音",
            "dynamic",
            "https://creator.douyin.com/creator-micro/content/upload?default-tab=3",
            "https://creator.douyin.com/",
        ),
        (
            "DYNAMIC_WEIBO",
            "微博",
            "dynamic",
            "https://weibo.com",
            "https://weibo.com",
        ),
        (
            "DYNAMIC_BILIBILI",
            "B站动态",
            "dynamic",
            "https://t.bilibili.com",
            "https://t.bilibili.com",
        ),
        (
            "DYNAMIC_ZHIHU",
            "知乎想法",
            "dynamic",
            "https://www.zhihu.com",
            "https://www.zhihu.com",
        ),
        (
            "DYNAMIC_WEIXINCHANNEL",
            "视频号",
            "dynamic",
            "https://channels.weixin.qq.com/platform/post/create",
            "https://channels.weixin.qq.com/",
        ),
        (
            "DYNAMIC_KUAISHOU",
            "快手",
            "dynamic",
            "https://cp.kuaishou.com/",
            "https://cp.kuaishou.com/",
        ),
        (
            "DYNAMIC_TOUTIAO",
            "今日头条",
            "dynamic",
            "https://www.toutiao.com/",
            "https://www.toutiao.com/",
        ),
        (
            "DYNAMIC_JUEJIN",
            "掘金",
            "dynamic",
            "https://juejin.cn/creator/post/publish",
            "https://juejin.cn/",
        ),
        (
            "ARTICLE_WEIXIN",
            "微信公众号",
            "article",
            "https://mp.weixin.qq.com/",
            "https://mp.weixin.qq.com/",
        ),
        (
            "ARTICLE_ZHIHU",
            "知乎文章",
            "article",
            "https://zhuanlan.zhihu.com/write",
            "https://www.zhihu.com/",
        ),
        (
            "ARTICLE_CSDN",
            "CSDN",
            "article",
            "https://editor.csdn.net/md/",
            "https://www.csdn.net/",
        ),
        (
            "ARTICLE_JUEJIN",
            "掘金文章",
            "article",
            "https://juejin.cn/editor/drafts/new?v=2",
            "https://juejin.cn/",
        ),
        (
            "ARTICLE_JIANSHU",
            "简书",
            "article",
            "https://www.jianshu.com/writer",
            "https://www.jianshu.com/",
        ),
        (
            "ARTICLE_TOUTIAO",
            "头条号",
            "article",
            "https://mp.toutiao.com/",
            "https://mp.toutiao.com/",
        ),
        (
            "VIDEO_DOUYIN",
            "抖音视频",
            "video",
            "https://creator.douyin.com/creator-micro/content/upload",
            "https://creator.douyin.com/",
        ),
        (
            "VIDEO_REDNOTE",
            "小红书视频",
            "video",
            "https://creator.xiaohongshu.com/publish/publish?target=video",
            "https://creator.xiaohongshu.com/",
        ),
        (
            "VIDEO_BILIBILI",
            "B站视频",
            "video",
            "https://member.bilibili.com/platform/upload/video/frame",
            "https://member.bilibili.com/",
        ),
        (
            "VIDEO_KUAISHOU",
            "快手视频",
            "video",
            "https://cp.kuaishou.com/article/publish/video",
            "https://cp.kuaishou.com/",
        ),
        (
            "VIDEO_WEIXINCHANNEL",
            "视频号视频",
            "video",
            "https://channels.weixin.qq.com/platform/post/create",
            "https://channels.weixin.qq.com/",
        ),
        (
            "VIDEO_ZHIHU",
            "知乎视频",
            "video",
            "https://www.zhihu.com/zvideo/upload-video",
            "https://www.zhihu.com/",
        ),
    ];

    let list: Vec<MediaPlatform> = seed
        .into_iter()
        .map(|(code, name, kind, inject, home)| MediaPlatform {
            id: Uuid::new_v4().to_string(),
            code: code.into(),
            name: name.into(),
            kind: kind.into(),
            inject_url: inject.into(),
            home_url: home.into(),
            enabled: true,
            notes: String::new(),
            updated_at: ts,
        })
        .collect();
    crate::persist::save_media_platforms(app, &list);
}

pub fn list_platforms(app: &AppHandle) -> Vec<MediaPlatform> {
    ensure_seeded(app);
    let mut list = crate::persist::load_media_platforms(app);
    list.sort_by(|a, b| {
        b.updated_at
            .cmp(&a.updated_at)
            .then_with(|| a.name.cmp(&b.name))
    });
    list
}

/// 分页列表：按类型/关键词过滤后返回当前页，并附带脚本发布状态。
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

    let publish_scripts = crate::persist::load_publish_scripts(app);
    let collect_scripts = crate::persist::load_collect_scripts(app);
    let items = page_slice
        .into_iter()
        .map(|platform| {
            let (script_is_published, script_has_unpublished_draft, script_published_version) =
                match publish_scripts.iter().find(|s| s.platform_id == platform.id) {
                    Some(s) => {
                        let v = script_view(s.clone());
                        (
                            v.is_published,
                            v.has_unpublished_draft,
                            v.script.published_version,
                        )
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
                    (
                        v.is_published,
                        v.has_unpublished_draft,
                        v.script.published_version,
                    )
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

    MediaPlatformPage {
        items,
        total,
        page,
        page_size,
    }
}

pub fn get_platform(app: &AppHandle, id: &str) -> Option<MediaPlatform> {
    ensure_seeded(app);
    crate::persist::load_media_platforms(app)
        .into_iter()
        .find(|p| p.id == id)
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
) -> Result<MediaPlatform, String> {
    ensure_seeded(app);
    let kind = normalize_kind(&kind)?;
    let code = code.trim().to_uppercase();
    let name = name.trim().to_string();
    if code.is_empty() {
        return Err("编码不能为空".into());
    }
    if name.is_empty() {
        return Err("名称不能为空".into());
    }

    let mut list = crate::persist::load_media_platforms(app);
    let ts = now_ms();

    if let Some(pid) = id.filter(|s| !s.trim().is_empty()) {
        if list
            .iter()
            .any(|p| p.code == code && p.id != pid)
        {
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
        item.updated_at = ts;
        let updated = item.clone();
        crate::persist::save_media_platforms(app, &list);
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
            updated_at: ts,
        };
        list.insert(0, platform.clone());
        crate::persist::save_media_platforms(app, &list);
        Ok(platform)
    }
}

pub fn set_platform_enabled(
    app: &AppHandle,
    id: String,
    enabled: bool,
) -> Result<MediaPlatform, String> {
    ensure_seeded(app);
    let mut list = crate::persist::load_media_platforms(app);
    let Some(item) = list.iter_mut().find(|p| p.id == id) else {
        return Err("平台不存在".into());
    };
    item.enabled = enabled;
    item.updated_at = now_ms();
    let updated = item.clone();
    crate::persist::save_media_platforms(app, &list);
    Ok(updated)
}

pub fn remove_platform(app: &AppHandle, id: String) -> Result<(), String> {
    ensure_seeded(app);
    let mut list = crate::persist::load_media_platforms(app);
    let before = list.len();
    list.retain(|p| p.id != id);
    if list.len() == before {
        return Err("平台不存在".into());
    }
    crate::persist::save_media_platforms(app, &list);
    let mut scripts = crate::persist::load_publish_scripts(app);
    scripts.retain(|s| s.platform_id != id);
    crate::persist::save_publish_scripts(app, &scripts);
    let mut collect = crate::persist::load_collect_scripts(app);
    collect.retain(|s| s.platform_id != id);
    crate::persist::save_collect_scripts(app, &collect);
    Ok(())
}

fn script_view(s: PublishScript) -> PublishScriptView {
    let is_published = s.published_version > 0 && !s.published_script.is_empty();
    let has_unpublished_draft = s.draft_script != s.published_script;
    PublishScriptView {
        script: s,
        has_unpublished_draft,
        is_published,
    }
}

pub fn list_scripts(app: &AppHandle, platform_id: Option<String>) -> Vec<PublishScriptView> {
    ensure_seeded(app);
    let mut list = crate::persist::load_publish_scripts(app);
    if let Some(pid) = platform_id.filter(|s| !s.is_empty()) {
        list.retain(|s| s.platform_id == pid);
    }
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list.into_iter().map(script_view).collect()
}

pub fn get_or_create_script(
    app: &AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let platform = get_platform(app, &platform_id).ok_or("平台不存在")?;
    let mut list = crate::persist::load_publish_scripts(app);
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
    crate::persist::save_publish_scripts(app, &list);
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
    let mut list = crate::persist::load_publish_scripts(app);
    let ts = now_ms();
    if let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) {
        item.kind = platform.kind.clone();
        item.draft_script = draft_script;
        item.match_url = match_url.trim().to_string();
        item.changelog = changelog.trim().to_string();
        item.updated_at = ts;
        let updated = item.clone();
        crate::persist::save_publish_scripts(app, &list);
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
    crate::persist::save_publish_scripts(app, &list);
    Ok(script_view(script))
}

pub fn publish_script(app: &AppHandle, platform_id: String) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = crate::persist::load_publish_scripts(app);
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
    crate::persist::save_publish_scripts(app, &list);
    Ok(script_view(updated))
}

pub fn discard_script_draft(
    app: &AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = crate::persist::load_publish_scripts(app);
    let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) else {
        return Err("脚本不存在".into());
    };
    item.draft_script = item.published_script.clone();
    item.updated_at = now_ms();
    let updated = item.clone();
    crate::persist::save_publish_scripts(app, &list);
    Ok(script_view(updated))
}

/// 扩展桥：仅返回已启用平台。
pub fn bridge_list_platforms(app: &AppHandle) -> Vec<BridgePlatform> {
    ensure_seeded(app);
    let scripts = crate::persist::load_publish_scripts(app);
    let collect_scripts = crate::persist::load_collect_scripts(app);
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

/// 扩展桥：只返回已发布填表脚本。
pub fn bridge_get_script(
    app: &AppHandle,
    code: &str,
) -> Result<BridgeScript, String> {
    bridge_get_script_of(app, code, false)
}

/// 扩展桥：只返回已发布采集脚本。
pub fn bridge_get_collect_script(
    app: &AppHandle,
    code: &str,
) -> Result<BridgeScript, String> {
    bridge_get_script_of(app, code, true)
}

fn bridge_get_script_of(
    app: &AppHandle,
    code: &str,
    collect: bool,
) -> Result<BridgeScript, String> {
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
        crate::persist::load_collect_scripts(app)
    } else {
        crate::persist::load_publish_scripts(app)
    }
    .into_iter()
    .find(|s| s.platform_id == platform.id)
    .ok_or_else(|| {
        if collect {
            "暂无采集脚本".to_string()
        } else {
            "暂无填表脚本".to_string()
        }
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

// ── Collect scripts（结构与发布脚本相同，独立存储）────────────────────────────

pub fn list_collect_scripts(
    app: &AppHandle,
    platform_id: Option<String>,
) -> Vec<PublishScriptView> {
    ensure_seeded(app);
    let mut list = crate::persist::load_collect_scripts(app);
    if let Some(pid) = platform_id.filter(|s| !s.is_empty()) {
        list.retain(|s| s.platform_id == pid);
    }
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    list.into_iter().map(script_view).collect()
}

pub fn get_or_create_collect_script(
    app: &AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let platform = get_platform(app, &platform_id).ok_or("平台不存在")?;
    let mut list = crate::persist::load_collect_scripts(app);
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
    crate::persist::save_collect_scripts(app, &list);
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
    let mut list = crate::persist::load_collect_scripts(app);
    let ts = now_ms();
    if let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) {
        item.kind = platform.kind.clone();
        item.draft_script = draft_script;
        item.match_url = match_url.trim().to_string();
        item.changelog = changelog.trim().to_string();
        item.updated_at = ts;
        let updated = item.clone();
        crate::persist::save_collect_scripts(app, &list);
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
    crate::persist::save_collect_scripts(app, &list);
    Ok(script_view(script))
}

pub fn publish_collect_script(
    app: &AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = crate::persist::load_collect_scripts(app);
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
    crate::persist::save_collect_scripts(app, &list);
    Ok(script_view(updated))
}

pub fn discard_collect_script_draft(
    app: &AppHandle,
    platform_id: String,
) -> Result<PublishScriptView, String> {
    ensure_seeded(app);
    let mut list = crate::persist::load_collect_scripts(app);
    let Some(item) = list.iter_mut().find(|s| s.platform_id == platform_id) else {
        return Err("脚本不存在".into());
    };
    item.draft_script = item.published_script.clone();
    item.updated_at = now_ms();
    let updated = item.clone();
    crate::persist::save_collect_scripts(app, &list);
    Ok(script_view(updated))
}
