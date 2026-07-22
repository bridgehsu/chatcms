use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub id: String,
    pub content: String,
    pub is_error: bool,
}

/// Tools that require explicit user permission before execution.
pub fn requires_permission(tool_name: &str) -> bool {
    matches!(tool_name, "bash" | "write_file")
}

/// Return tool definitions to include in the API request.
pub fn all_tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "spawn_agent".to_string(),
            description: "Spawn a sub-agent to handle a specific sub-task. The sub-agent has access to all tools. Returns the sub-agent's final response. Use this to parallelize work or delegate specialized tasks.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "The task or question for the sub-agent"},
                    "system_prompt": {"type": "string", "description": "Optional persona or focus for the sub-agent"}
                },
                "required": ["prompt"]
            }),
        },
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
        },
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
        },
        ToolDef {
            name: "bash".to_string(),
            description: "Execute a shell command via /bin/sh and return stdout/stderr.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to run"}
                },
                "required": ["command"]
            }),
        },
    ]
}

/// Execute a tool call and return the result.
pub async fn execute(call: &ToolCall) -> ToolResult {
    let result: Result<String, String> = match call.name.as_str() {
        "read_file" => {
            let path = call.input["path"].as_str().unwrap_or("");
            tokio::fs::read_to_string(path)
                .await
                .map_err(|e| e.to_string())
        }
        "write_file" => {
            let path = call.input["path"].as_str().unwrap_or("");
            let content = call.input["content"].as_str().unwrap_or("");
            // Create parent directories if needed
            if let Some(parent) = std::path::Path::new(path).parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }
            tokio::fs::write(path, content)
                .await
                .map(|_| format!("Written {} bytes to {}", content.len(), path))
                .map_err(|e| e.to_string())
        }
        "bash" => {
            let command = call.input["command"].as_str().unwrap_or("");
            let output = std::process::Command::new("/bin/sh")
                .arg("-c")
                .arg(command)
                .output();
            match output {
                Ok(out) => {
                    let mut combined = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    if !stderr.is_empty() {
                        if !combined.is_empty() {
                            combined.push('\n');
                        }
                        combined.push_str(&stderr);
                    }
                    if out.status.success() || !combined.is_empty() {
                        Ok(combined)
                    } else {
                        Err(format!("exit code: {}", out.status))
                    }
                }
                Err(e) => Err(e.to_string()),
            }
        }
        name => Err(format!("Unknown tool: {name}")),
    };

    match result {
        Ok(content) => ToolResult {
            id: call.id.clone(),
            content,
            is_error: false,
        },
        Err(msg) => ToolResult {
            id: call.id.clone(),
            content: msg,
            is_error: true,
        },
    }
}
