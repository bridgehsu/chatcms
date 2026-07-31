pub mod commands;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MapLink {
    pub id: String,
    pub title: String,
    pub desc: String,
    pub mark: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub tone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MapSection {
    pub id: String,
    pub title: String,
    pub icon: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub locked: bool,
    #[serde(default)]
    pub collapsed: bool,
    pub links: Vec<MapLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MapMetric {
    pub id: String,
    pub label: String,
    pub value: String,
    pub change: String,
    pub trend: String, // "up" | "down" | "flat"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BusinessMapState {
    #[serde(default)]
    pub favorites: Vec<MapLink>,
    #[serde(default)]
    pub sections: Vec<MapSection>,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub metrics: Vec<MapMetric>,
}

/// 扩展导航用的精简视图（常用工具 + 分类 + 网站）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapNavView {
    pub favorites: Vec<MapLink>,
    pub sections: Vec<MapSection>,
}

pub fn get(app: &AppHandle) -> BusinessMapState {
    let mut state = crate::persist::load_business_map(app);
    state.sections.sort_by_key(|s| s.sort_order);
    state
}

pub fn save(app: &AppHandle, state: BusinessMapState) {
    crate::persist::save_business_map(app, &state);
}

pub fn nav_view(app: &AppHandle) -> MapNavView {
    let state = get(app);
    MapNavView {
        favorites: state.favorites,
        sections: state.sections,
    }
}

fn default_mark(title: &str) -> String {
    title
        .chars()
        .next()
        .map(|c| c.to_string())
        .unwrap_or_else(|| "链".into())
}

fn normalize_url(raw: Option<String>) -> Option<String> {
    raw.map(|u| u.trim().to_string()).filter(|u| !u.is_empty())
}

/// 增改入口。`section_id` 为 `"favorites"` 或分类 id。
/// 插件侧允许编辑锁定分类下的链接（与桌面锁定策略不同）。
pub fn upsert_link(
    app: &AppHandle,
    section_id: &str,
    link_id: Option<String>,
    title: String,
    desc: String,
    mark: String,
    url: Option<String>,
    tone: Option<String>,
) -> Result<MapLink, String> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err("标题不能为空".into());
    }
    let desc = desc.trim().to_string();
    let mark = {
        let m = mark.trim();
        if m.is_empty() {
            default_mark(&title)
        } else {
            m.chars().take(2).collect()
        }
    };
    let url = normalize_url(url);
    let tone = tone
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty());

    let mut state = get(app);
    let section_id = section_id.trim();

    if section_id == "favorites" {
        if let Some(id) = link_id {
            let link = state
                .favorites
                .iter_mut()
                .find(|l| l.id == id)
                .ok_or_else(|| "常用工具不存在".to_string())?;
            link.title = title;
            link.desc = desc;
            link.mark = mark;
            link.url = url;
            link.tone = tone;
            let out = link.clone();
            save(app, state);
            return Ok(out);
        }
        let link = MapLink {
            id: Uuid::new_v4().to_string(),
            title,
            desc,
            mark,
            url,
            tone,
        };
        state.favorites.push(link.clone());
        save(app, state);
        return Ok(link);
    }

    let section = state
        .sections
        .iter_mut()
        .find(|s| s.id == section_id)
        .ok_or_else(|| "分类不存在".to_string())?;

    if let Some(id) = link_id {
        let link = section
            .links
            .iter_mut()
            .find(|l| l.id == id)
            .ok_or_else(|| "入口不存在".to_string())?;
        link.title = title;
        link.desc = desc;
        link.mark = mark;
        link.url = url;
        link.tone = tone;
        let out = link.clone();
        save(app, state);
        return Ok(out);
    }

    let link = MapLink {
        id: Uuid::new_v4().to_string(),
        title,
        desc,
        mark,
        url,
        tone,
    };
    section.links.push(link.clone());
    save(app, state);
    Ok(link)
}

pub fn remove_link(app: &AppHandle, section_id: &str, link_id: &str) -> Result<(), String> {
    let mut state = get(app);
    let section_id = section_id.trim();
    let link_id = link_id.trim();

    if section_id == "favorites" {
        let before = state.favorites.len();
        state.favorites.retain(|l| l.id != link_id);
        if state.favorites.len() == before {
            return Err("常用工具不存在".into());
        }
        save(app, state);
        return Ok(());
    }

    let section = state
        .sections
        .iter_mut()
        .find(|s| s.id == section_id)
        .ok_or_else(|| "分类不存在".to_string())?;
    let before = section.links.len();
    section.links.retain(|l| l.id != link_id);
    if section.links.len() == before {
        return Err("入口不存在".into());
    }
    save(app, state);
    Ok(())
}
