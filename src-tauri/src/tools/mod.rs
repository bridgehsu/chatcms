pub mod bash;
pub mod read_file;
pub mod spawn_agent;
pub mod types;
pub mod write_file;

pub use types::{ToolCall, ToolDef, ToolResult};

/// Tools that require explicit user permission before execution.
pub fn requires_permission(tool_name: &str) -> bool {
    matches!(tool_name, "bash" | "write_file")
}

/// Return all tool definitions to include in the API request.
pub fn all_tools() -> Vec<ToolDef> {
    vec![
        spawn_agent::def(),
        read_file::def(),
        write_file::def(),
        bash::def(),
    ]
}

/// Check that `path` resolves to a location inside `workspace_dir`.
/// For not-yet-existing files, the parent directory is canonicalized instead.
pub fn check_workspace(workspace_dir: &str, path: &str) -> Result<(), String> {
    let ws = std::path::Path::new(workspace_dir)
        .canonicalize()
        .map_err(|_| format!("Workspace directory not accessible: {workspace_dir}"))?;

    let target = std::path::Path::new(path);
    let canonical = if target.exists() {
        target.canonicalize().map_err(|e| e.to_string())?
    } else {
        let parent = target.parent().unwrap_or(std::path::Path::new("."));
        let canon_parent = parent
            .canonicalize()
            .map_err(|_| format!("Parent directory not found: {}", parent.display()))?;
        canon_parent.join(target.file_name().unwrap_or_default())
    };

    if !canonical.starts_with(&ws) {
        return Err(format!(
            "Path `{path}` is outside agent workspace `{workspace_dir}`"
        ));
    }
    Ok(())
}

/// Execute a tool call and return the result.
///
/// `workspace_dir` – when `Some`, file tools are restricted to that directory
/// and bash runs with it as the working directory.
///
/// Note: `spawn_agent` is handled upstream in the agent dispatch layer.
pub async fn execute(call: &ToolCall, workspace_dir: Option<&str>) -> ToolResult {
    let result: Result<String, String> = match call.name.as_str() {
        "read_file" => read_file::execute(call, workspace_dir).await,
        "write_file" => write_file::execute(call, workspace_dir).await,
        "bash" => bash::execute(call, workspace_dir).await,
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
