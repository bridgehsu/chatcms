use std::collections::HashSet;

use super::types::KnowledgeEntry;

fn is_cjk(c: char) -> bool {
    ('\u{4e00}'..='\u{9fff}').contains(&c) || ('\u{3400}'..='\u{4dbf}').contains(&c)
}

fn tokenize(text: &str) -> HashSet<String> {
    let lower = text.to_lowercase();
    let mut tokens: HashSet<String> = lower
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|s| s.len() >= 2)
        .map(|s| s.to_string())
        .collect();

    // CJK single chars + consecutive bigrams for better partial matching
    let cjk_chars: Vec<char> = text.chars().filter(|c| is_cjk(*c)).collect();
    for &c in &cjk_chars {
        tokens.insert(c.to_string());
    }
    for pair in cjk_chars.windows(2) {
        tokens.insert(format!("{}{}", pair[0], pair[1]));
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
        sorted.sort_by(|a, b| b.created.cmp(&a.created));
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
