use serde_json::json;

use super::types::{ToolCall, ToolDef};

pub fn def() -> ToolDef {
    ToolDef {
        name: "read_file".to_string(),
        description: "Read the contents of a file at the given path.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute or relative file path"}
            },
            "required": ["path"]
        }),
    }
}

pub async fn execute(call: &ToolCall, workspace_dir: Option<&str>) -> Result<String, String> {
    let path = call.input["path"].as_str().unwrap_or("");
    if let Some(ws) = workspace_dir {
        super::check_workspace(ws, path)?;
    }
    tokio::fs::read_to_string(path)
        .await
        .map_err(|e| e.to_string())
}
