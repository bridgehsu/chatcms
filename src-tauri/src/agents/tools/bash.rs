use serde_json::json;
use tokio::time::{timeout, Duration};

use super::types::{ToolCall, ToolDef};

/// bash 命令最长执行时间
const BASH_TIMEOUT_SECS: u64 = 120;

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
    let command = call.input["command"].as_str().unwrap_or("").to_string();
    let cwd = workspace_dir.map(|s| s.to_string());

    let task = async move {
        let mut cmd = tokio::process::Command::new("/bin/sh");
        cmd.arg("-c").arg(&command);
        if let Some(ws) = &cwd {
            cmd.current_dir(ws);
        }
        cmd.output().await
    };

    match timeout(Duration::from_secs(BASH_TIMEOUT_SECS), task).await {
        Ok(Ok(out)) => {
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
        Ok(Err(e)) => Err(e.to_string()),
        Err(_) => Err(format!(
            "bash: command timed out after {}s",
            BASH_TIMEOUT_SECS
        )),
    }
}
