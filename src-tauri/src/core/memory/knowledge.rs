//! 知识库检索块（按模式 limit 注入 system prompt）。

use tauri::State;

use crate::agents::AgentState;
use crate::kbase as knowledge;

pub fn knowledge_block(state: &State<'_, AgentState>, content: &str, limit: usize) -> Option<String> {
    if limit == 0 {
        return None;
    }
    let entries = state.knowledge.lock().unwrap().clone();
    let relevant = knowledge::search(&entries, content, limit);
    let text = knowledge::format_for_prompt(&relevant);
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}
