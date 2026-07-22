use serde::{Deserialize, Serialize};
use std::collections::HashSet;

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
}

impl KnowledgeEntry {
    pub fn new(title: String, description: String, content: String, tags: Vec<String>) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            description,
            content,
            tags,
            created_at: now,
        }
    }
}

// ── Heuristic search ──────────────────────────────────────────────────────────

fn tokenize(text: &str) -> HashSet<String> {
    let lower = text.to_lowercase();
    let mut tokens: HashSet<String> = lower
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|s| s.len() >= 2)
        .map(|s| s.to_string())
        .collect();
    // CJK characters each carry independent meaning
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
            s += 2.0; // title/description/tag match weighted higher
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
        // No query → return most recent
        let mut sorted = entries.to_vec();
        sorted.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        return sorted.into_iter().take(max).collect();
    }

    let mut scored: Vec<(f32, &KnowledgeEntry)> = entries
        .iter()
        .filter_map(|e| {
            let s = score(e, &tokens);
            if s > 0.0 { Some((s, e)) } else { None }
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.into_iter().take(max).map(|(_, e)| e.clone()).collect()
}

/// Format selected entries as a system-prompt block.
pub fn format_for_prompt(entries: &[KnowledgeEntry]) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let mut parts = vec!["<memory>".to_string()];
    for e in entries {
        parts.push(format!("### {}\n{}\n\n{}", e.title, e.description, e.content));
    }
    parts.push("</memory>".to_string());
    parts.join("\n\n")
}
