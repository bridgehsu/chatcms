use std::collections::HashSet;

use super::types::Skill;

/// 导出为 OpenClaw SKILL.md 文本（预览 / 复制）。
pub fn to_skill_md(skill: &Skill) -> String {
    let mut fm = format!(
        "---\nname: {}\ndescription: \"{}\"\n",
        skill.name,
        skill.description.replace('"', "\\\"")
    );
    if !skill.user_invocable {
        fm.push_str("user-invocable: false\n");
    }
    if skill.disable_model_invocation {
        fm.push_str("disable-model-invocation: true\n");
    }
    if let Some(url) = &skill.homepage {
        fm.push_str(&format!("homepage: {url}\n"));
    }
    if let Some(meta) = &skill.metadata {
        if let Ok(s) = serde_json::to_string(meta) {
            fm.push_str(&format!("metadata: {s}\n"));
        }
    }
    fm.push_str("---\n\n");
    fm.push_str(skill.body.trim());
    fm.push('\n');
    fm
}

fn tokenize(text: &str) -> HashSet<String> {
    let lower = text.to_lowercase();
    let mut tokens: HashSet<String> = lower
        .split(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
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

fn score_skill(skill: &Skill, tokens: &HashSet<String>) -> f32 {
    let meta = format!("{} {}", skill.name, skill.description).to_lowercase();
    let body = skill.body.to_lowercase();
    let mut s = 0.0f32;
    for t in tokens {
        if meta.contains(t.as_str()) {
            s += 2.0;
        } else if body.contains(t.as_str()) {
            s += 1.0;
        }
    }
    s
}

/// 拼进 system prompt：始终给技能目录；相关技能附带正文（OpenClaw 风格）。
/// `allowlist`: None = 全部启用技能；Some([]) = 无；Some(names) = 白名单。
pub fn format_for_prompt(
    skills: &[Skill],
    query: &str,
    allowlist: Option<&[String]>,
) -> String {
    let eligible: Vec<&Skill> = skills
        .iter()
        .filter(|s| s.enabled && !s.disable_model_invocation)
        .filter(|s| match allowlist {
            None => true,
            Some(list) if list.is_empty() => false,
            Some(list) => list.iter().any(|n| n == &s.name),
        })
        .collect();
    if eligible.is_empty() {
        return String::new();
    }

    let mut parts = vec!["<skills>".to_string()];
    parts.push(
        "The following skills teach you specialized workflows. Prefer them when the user request matches a skill description."
            .into(),
    );
    parts.push("## Skill catalog".into());
    for s in &eligible {
        parts.push(format!("- **{}**: {}", s.name, s.description));
    }

    let tokens = tokenize(query);
    if !tokens.is_empty() {
        let mut scored: Vec<(f32, &Skill)> = eligible
            .iter()
            .filter_map(|s| {
                let sc = score_skill(s, &tokens);
                if sc > 0.0 {
                    Some((sc, *s))
                } else {
                    None
                }
            })
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let matched: Vec<&Skill> = scored.into_iter().take(2).map(|(_, s)| s).collect();
        if !matched.is_empty() {
            parts.push("## Active skill instructions".into());
            for s in matched {
                parts.push(format!(
                    "### {}\n{}\n\n{}",
                    s.name,
                    s.description,
                    s.body.trim()
                ));
            }
        }
    }

    parts.push("</skills>".into());
    parts.join("\n\n")
}
