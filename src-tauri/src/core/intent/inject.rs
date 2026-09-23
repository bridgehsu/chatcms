//! 软注入：Intent → system prompt 块（不改 Intent，不短路 Agent Loop）。

use super::intent_result::{Intent, IntentKind};

/// 写入 system prompt 的意图提示块；置信度过低则省略。
pub fn format_for_prompt(intent: &Intent) -> Option<String> {
    if intent.confidence < 0.35 && intent.kind == IntentKind::Unknown {
        return None;
    }
    let hint = match intent.kind {
        IntentKind::GeneralChat => {
            "Prefer a concise natural-language answer. Avoid tool use unless the user clearly asks to act on files or systems."
        }
        IntentKind::UseTools => {
            "The user likely wants you to take action via tools (files, shell, MCP). Prefer tools when appropriate, then summarize."
        }
        IntentKind::ContentPublish => {
            "The user likely wants content publishing / multi-platform sync. Prefer publish-related skills and tools."
        }
        IntentKind::AccountLookup => {
            "The user likely asks about accounts or credentials. Be careful with secrets; use account tools only when authorized."
        }
        IntentKind::Unknown => {
            "Intent is unclear; ask a brief clarifying question if needed, or proceed cautiously."
        }
    };
    let matched = if intent.matched.is_empty() {
        String::new()
    } else {
        format!("\nmatched_keywords: {}", intent.matched.join(", "))
    };
    Some(format!(
        "<user_intent>\nkind: {} ({})\nconfidence: {:.2}{}\nsource: {}\nneeds_tools: {}\nhint: {}\n</user_intent>",
        intent.kind.as_str(),
        intent.kind.label_zh(),
        intent.confidence,
        matched,
        intent.source.as_str(),
        intent.needs_tools,
        hint
    ))
}
