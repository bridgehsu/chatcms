use super::types::{slugify, now_secs, KnowledgeEntry, KnowledgeSiteProfile, PublicFeed, PublicFeedItem};

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
