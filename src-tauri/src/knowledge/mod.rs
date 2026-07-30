pub mod commands;

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub description: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: u64,
    /// private | public（默认私有；公开条目可导出到 chatcms.org）
    #[serde(default = "default_visibility")]
    pub visibility: String,
    /// note | doc | faq
    #[serde(default = "default_kind")]
    pub kind: String,
    /// 公开 URL 路径段；公开时建议填写
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub updated_at: u64,
}

fn default_visibility() -> String {
    "private".into()
}

fn default_kind() -> String {
    "note".into()
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn slugify(raw: &str) -> String {
    let mut out = String::new();
    for c in raw.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if ('\u{4e00}'..='\u{9fff}').contains(&c) {
            out.push(c);
        } else if c == '-' || c == '_' || c == ' ' {
            if !out.is_empty() && !out.ends_with('-') {
                out.push('-');
            }
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        format!("entry-{}", &uuid::Uuid::new_v4().to_string()[..8])
    } else {
        trimmed.chars().take(64).collect()
    }
}

/// 规范化公开路径段；空输入返回空字符串（调用方决定是否用标题生成）。
pub fn normalize_slug(raw: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        String::new()
    } else {
        slugify(s)
    }
}

fn normalize_visibility(v: &str) -> String {
    match v.trim().to_lowercase().as_str() {
        "public" => "public".into(),
        _ => "private".into(),
    }
}

fn normalize_kind(k: &str) -> String {
    match k.trim().to_lowercase().as_str() {
        "doc" => "doc".into(),
        "faq" => "faq".into(),
        _ => "note".into(),
    }
}

impl KnowledgeEntry {
    pub fn new(
        title: String,
        description: String,
        content: String,
        tags: Vec<String>,
        visibility: String,
        kind: String,
        slug: String,
    ) -> Self {
        let now = now_secs();
        let visibility = normalize_visibility(&visibility);
        let kind = normalize_kind(&kind);
        let slug = {
            let s = slug.trim();
            if s.is_empty() {
                if visibility == "public" {
                    slugify(&title)
                } else {
                    String::new()
                }
            } else {
                slugify(s)
            }
        };
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            description,
            content,
            tags,
            created_at: now,
            visibility,
            kind,
            slug,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSiteProfile {
    /// 公开主页 handle，如 alice → /u/alice
    #[serde(default = "default_handle")]
    pub handle: String,
    #[serde(default = "default_display_name")]
    pub display_name: String,
    #[serde(default)]
    pub bio: String,
}

fn default_handle() -> String {
    "me".into()
}

fn default_display_name() -> String {
    "ChatCMS User".into()
}

impl Default for KnowledgeSiteProfile {
    fn default() -> Self {
        Self {
            handle: default_handle(),
            display_name: default_display_name(),
            bio: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicFeedItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub slug: String,
    pub kind: String,
    pub tags: Vec<String>,
    pub updated_at: u64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicFeed {
    pub handle: String,
    pub display_name: String,
    pub bio: String,
    pub updated_at: u64,
    pub items: Vec<PublicFeedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub handle: String,
    pub output_dir: String,
    pub count: usize,
    pub feed_path: String,
}

// ── Heuristic search ──────────────────────────────────────────────────────────

fn tokenize(text: &str) -> HashSet<String> {
    let lower = text.to_lowercase();
    let mut tokens: HashSet<String> = lower
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|s| s.len() >= 2)
        .map(|s| s.to_string())
        .collect();
    for c in text.chars() {
        if ('\u{4e00}'..='\u{9fff}').contains(&c) || ('\u{3400}'..='\u{4dbf}').contains(&c) {
            tokens.insert(c.to_string());
        }
    }
    tokens
}

fn score(entry: &KnowledgeEntry, query_tokens: &HashSet<String>) -> f32 {
    let meta = format!(
        "{} {} {}",
        entry.title,
        entry.description,
        entry.tags.join(" ")
    )
    .to_lowercase();
    let body = entry.content.to_lowercase();

    let mut s = 0.0f32;
    for t in query_tokens {
        if meta.contains(t.as_str()) {
            s += 2.0;
        } else if body.contains(t.as_str()) {
            s += 1.0;
        }
    }
    s
}

pub fn search(entries: &[KnowledgeEntry], query: &str, max: usize) -> Vec<KnowledgeEntry> {
    if entries.is_empty() {
        return vec![];
    }
    let tokens = tokenize(query);
    if tokens.is_empty() {
        let mut sorted = entries.to_vec();
        sorted.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        return sorted.into_iter().take(max).collect();
    }

    let mut scored: Vec<(f32, &KnowledgeEntry)> = entries
        .iter()
        .filter_map(|e| {
            let s = score(e, &tokens);
            if s > 0.0 {
                Some((s, e))
            } else {
                None
            }
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored
        .into_iter()
        .take(max)
        .map(|(_, e)| e.clone())
        .collect()
}

/// Format selected entries as a system-prompt block.
pub fn format_for_prompt(entries: &[KnowledgeEntry]) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let mut parts = vec!["<memory>".to_string()];
    for e in entries {
        parts.push(format!(
            "### {}\n{}\n\n{}",
            e.title, e.description, e.content
        ));
    }
    parts.push("</memory>".to_string());
    parts.join("\n\n")
}

pub fn list_public(entries: &[KnowledgeEntry]) -> Vec<KnowledgeEntry> {
    let mut list: Vec<_> = entries
        .iter()
        .filter(|e| e.visibility == "public")
        .cloned()
        .collect();
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then(b.created_at.cmp(&a.created_at)));
    list
}

pub fn build_feed(profile: &KnowledgeSiteProfile, entries: &[KnowledgeEntry]) -> PublicFeed {
    let public = list_public(entries);
    let items = public
        .iter()
        .map(|e| {
            let slug = if e.slug.is_empty() {
                slugify(&e.title)
            } else {
                e.slug.clone()
            };
            PublicFeedItem {
                id: e.id.clone(),
                title: e.title.clone(),
                description: e.description.clone(),
                slug: slug.clone(),
                kind: e.kind.clone(),
                tags: e.tags.clone(),
                updated_at: if e.updated_at > 0 {
                    e.updated_at
                } else {
                    e.created_at
                },
                path: format!("/u/{}/{slug}", profile.handle),
            }
        })
        .collect::<Vec<_>>();
    let updated_at = items.iter().map(|i| i.updated_at).max().unwrap_or(now_secs());
    PublicFeed {
        handle: profile.handle.clone(),
        display_name: profile.display_name.clone(),
        bio: profile.bio.clone(),
        updated_at,
        items,
    }
}

/// 将公开知识导出为 chatcms.org 可消费的静态快照。
pub fn export_public_site(
    profile: &KnowledgeSiteProfile,
    entries: &[KnowledgeEntry],
    output_dir: &str,
) -> Result<ExportResult, String> {
    let handle = profile.handle.trim();
    if handle.is_empty() {
        return Err("请先设置公开主页 handle".into());
    }
    if !handle
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("handle 仅允许字母数字与 - _".into());
    }

    let root = Path::new(output_dir);
    let user_dir = root.join("users").join(handle);
    fs::create_dir_all(&user_dir).map_err(|e| format!("创建目录失败: {e}"))?;

    // 清理旧 md（保留 feed / llms）
    if user_dir.exists() {
        for ent in fs::read_dir(&user_dir).map_err(|e| e.to_string())? {
            let ent = ent.map_err(|e| e.to_string())?;
            let path = ent.path();
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                let _ = fs::remove_file(&path);
            }
        }
    }

    let public = list_public(entries);
    if public.is_empty() {
        return Err("没有可见性为「公开」的知识条目".into());
    }

    let mut assigned: Vec<String> = Vec::new();
    {
        let mut seen = HashSet::new();
        for e in &public {
            let mut slug = if e.slug.is_empty() {
                slugify(&e.title)
            } else {
                slugify(&e.slug)
            };
            let base = slug.clone();
            let mut n = 2;
            while seen.contains(&slug) {
                slug = format!("{base}-{n}");
                n += 1;
            }
            seen.insert(slug.clone());
            assigned.push(slug);
        }
    }

    for (e, slug) in public.iter().zip(assigned.iter()) {
        let updated = if e.updated_at > 0 {
            e.updated_at
        } else {
            e.created_at
        };
        let tags = if e.tags.is_empty() {
            String::new()
        } else {
            format!(
                "\ntags: [{}]",
                e.tags
                    .iter()
                    .map(|t| format!("\"{t}\""))
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        };
        let md = format!(
            "---\nid: {}\ntitle: \"{}\"\ndescription: \"{}\"\nkind: {}\nslug: {}\nupdated_at: {}{}\n---\n\n# {}\n\n{}\n",
            e.id,
            e.title.replace('"', "'"),
            e.description.replace('"', "'"),
            e.kind,
            slug,
            updated,
            tags,
            e.title,
            e.content.trim()
        );
        let path = user_dir.join(format!("{slug}.md"));
        fs::write(&path, md).map_err(|err| format!("写入失败 {}: {err}", path.display()))?;
    }

    let items: Vec<PublicFeedItem> = public
        .iter()
        .zip(assigned.iter())
        .map(|(e, slug)| PublicFeedItem {
            id: e.id.clone(),
            title: e.title.clone(),
            description: e.description.clone(),
            slug: slug.clone(),
            kind: e.kind.clone(),
            tags: e.tags.clone(),
            updated_at: if e.updated_at > 0 {
                e.updated_at
            } else {
                e.created_at
            },
            path: format!("/u/{handle}/{slug}"),
        })
        .collect();
    let feed = PublicFeed {
        handle: handle.into(),
        display_name: profile.display_name.clone(),
        bio: profile.bio.clone(),
        updated_at: items
            .iter()
            .map(|i| i.updated_at)
            .max()
            .unwrap_or(now_secs()),
        items,
    };

    let feed_path = user_dir.join("feed.json");
    let feed_json =
        serde_json::to_string_pretty(&feed).map_err(|e| format!("序列化 feed 失败: {e}"))?;
    fs::write(&feed_path, feed_json).map_err(|e| format!("写入 feed 失败: {e}"))?;

    let mut llms = String::from("# ChatCMS Public Knowledge\n\n");
    llms.push_str(&format!(
        "> {} — {}\n\n",
        feed.display_name,
        if feed.bio.is_empty() {
            "Personal public knowledge"
        } else {
            feed.bio.as_str()
        }
    ));
    llms.push_str(&format!("- Home: /u/{handle}/\n"));
    llms.push_str(&format!("- Feed: /u/{handle}/feed.json\n\n"));
    llms.push_str("## Docs\n\n");
    for item in &feed.items {
        llms.push_str(&format!(
            "- [{}]({}): {}\n",
            item.title,
            item.path,
            if item.description.is_empty() {
                item.kind.as_str()
            } else {
                item.description.as_str()
            }
        ));
    }
    fs::write(user_dir.join("llms.txt"), llms).map_err(|e| format!("写入 llms.txt 失败: {e}"))?;

    Ok(ExportResult {
        handle: handle.into(),
        output_dir: user_dir.display().to_string(),
        count: feed.items.len(),
        feed_path: feed_path.display().to_string(),
    })
}
