use serde_json::json;

use super::types::{ToolCall, ToolDef};

pub fn def() -> ToolDef {
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
    }
}

pub async fn execute(call: &ToolCall, workspace_dir: Option<&str>) -> Result<String, String> {
    let command = call.input["command"].as_str().unwrap_or("");
    let mut cmd = std::process::Command::new("/bin/sh");
    cmd.arg("-c").arg(command);
    if let Some(ws) = workspace_dir {
        cmd.current_dir(ws);
    }
    let output = cmd.output();
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
