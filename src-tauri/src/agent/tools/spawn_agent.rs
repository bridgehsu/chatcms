use serde_json::json;

use super::types::ToolDef;

pub fn def() -> ToolDef {
    ToolDef {
        name: "spawn_agent".to_string(),
        description: "Spawn a sub-agent to handle a specific sub-task. Prefer selecting a configured agent by slug when available. Returns the sub-agent's final response.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "The task or question for the sub-agent"},
                "agent": {"type": "string", "description": "Optional agent slug/id from 代理管理 (e.g. writer, researcher)"},
                "system_prompt": {"type": "string", "description": "Optional persona override; used when agent is omitted"}
            },
            "required": ["prompt"]
        }),
    }
}

// spawn_agent execution is handled by the agent dispatch layer (subagent.rs),
// not here, because it requires async agent infrastructure beyond a simple tool call.
