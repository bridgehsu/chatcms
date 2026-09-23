//! System prompt 与 API 消息组装。

use tauri::State;

use crate::agents::AgentState;
use crate::core::decision::ChatMode;
use crate::core::intent::{self, Intent};
use crate::core::memory;
use crate::common::provider;
use crate::scripts;
use serde_json::Value;

pub fn build_system_prompt(
    state: &State<'_, AgentState>,
    content: &str,
    active_agent: Option<crate::agents::AgentProfile>,
    intent: &Intent,
    mode: ChatMode,
) -> Option<String> {
    let mut blocks: Vec<String> = Vec::new();
    if let Some(p) = active_agent.as_ref().map(crate::agents::format_persona) {
        blocks.push(p);
    }
    if mode.inject_intent_block() {
        if let Some(i) = intent::format_for_prompt(intent) {
            blocks.push(i);
        }
    }
    if mode.inject_knowledge() {
        if let Some(m) = memory::knowledge_block(state, content, mode.knowledge_limit()) {
            blocks.push(m);
        }
    }
    if mode.inject_skills() {
        if let Some(s) = skills_block(state, content, active_agent.as_ref()) {
            blocks.push(s);
        }
    }
    if mode == ChatMode::Search {
        blocks.push(
            "<mode_hint>\n你处于 Search 模式：优先依据上方知识库检索结果回答；若无相关条目请明确说明，不要编造。不要调用系统工具。\n</mode_hint>"
                .into(),
        );
    }
    if blocks.is_empty() {
        None
    } else {
        Some(blocks.join("\n\n"))
    }
}

pub fn skills_block(
    state: &State<'_, AgentState>,
    content: &str,
    active_agent: Option<&crate::agents::AgentProfile>,
) -> Option<String> {
    let skill_list = state.skills.lock().unwrap().clone();
    let allowlist = active_agent.and_then(|a| a.skills.as_ref().map(|v| v.as_slice()));
    let text = scripts::format_for_prompt(&skill_list, content, allowlist);
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

pub fn build_api_messages(state: &State<'_, AgentState>, sid: &str, kind: &str) -> Vec<Value> {
    let sessions = state.sessions.lock().unwrap();
    let msgs = sessions
        .get(sid)
        .map(|s| s.messages.as_slice())
        .unwrap_or(&[]);
    match kind {
        "anthropic" => provider::messages_to_anthropic(msgs),
        _ => provider::messages_to_openai(msgs),
    }
}
