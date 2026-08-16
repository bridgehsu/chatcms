use std::collections::HashSet;
use std::fs;
use std::path::Path;

use super::feed::list_public;
use super::types::{slugify, now_secs, ExportResult, KnowledgeEntry, KnowledgeSiteProfile, PublicFeed, PublicFeedItem};

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
        let updated = if e.updated > 0 {
            e.updated
        } else {
            e.created
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
            updated: if e.updated > 0 {
                e.updated
            } else {
                e.created
            },
            path: format!("/u/{handle}/{slug}"),
        })
        .collect();
    let feed = PublicFeed {
        handle: handle.into(),
        display_name: profile.display_name.clone(),
        bio: profile.bio.clone(),
        updated: items
            .iter()
            .map(|i| i.updated)
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
