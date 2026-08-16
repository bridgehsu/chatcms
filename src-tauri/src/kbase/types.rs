use serde::{Deserialize, Serialize};

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub description: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created: u64,
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
    pub updated: u64,
}

fn default_visibility() -> String {
    "private".into()
}

fn default_kind() -> String {
    "note".into()
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub(super) fn slugify(raw: &str) -> String {
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
            created: now,
            visibility,
            kind,
            slug,
            updated: now,
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
    pub updated: u64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicFeed {
    pub handle: String,
    pub display_name: String,
    pub bio: String,
    pub updated: u64,
    pub items: Vec<PublicFeedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub handle: String,
    pub output_dir: String,
    pub count: usize,
    pub feed_path: String,
}
