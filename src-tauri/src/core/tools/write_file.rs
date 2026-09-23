use serde_json::json;

use super::types::{ToolCall, ToolDef};

pub fn def() -> ToolDef {
    ToolDef {
        name: "write_file".to_string(),
        description: "Write content to a file, creating it if it does not exist.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path to write"},
                "content": {"type": "string", "description": "Text content to write"}
            },
            "required": ["path", "content"]
        }),
    }
}

pub async fn execute(call: &ToolCall, workspace_dir: Option<&str>) -> Result<String, String> {
    let path = call.input["path"].as_str().unwrap_or("");
    let content = call.input["content"].as_str().unwrap_or("");
    if let Some(ws) = workspace_dir {
        // Ensure workspace exists before path check
        tokio::fs::create_dir_all(ws)
            .await
            .map_err(|e| format!("Cannot create workspace `{ws}`: {e}"))?;
        super::check_workspace(ws, path)?;
    }
    if let Some(parent) = std::path::Path::new(path).parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    tokio::fs::write(path, content)
        .await
        .map(|_| format!("Written {} bytes to {}", content.len(), path))
        .map_err(|e| e.to_string())
}
