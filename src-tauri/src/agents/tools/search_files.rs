use serde_json::json;
use super::types::{ToolCall, ToolDef};
use std::path::Path;

const MAX_MATCHES: usize = 50;
const MAX_FILE_SIZE: u64 = 500_000; // 500 KB

pub fn def() -> ToolDef {
    ToolDef {
        name: "search_files".to_string(),
        description: "Search file contents for a text pattern (case-insensitive) within the workspace. Returns file paths and matching line excerpts.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Text to search for (case-insensitive)"},
                "path": {"type": "string", "description": "Sub-directory to search in (default: workspace root)"},
                "max_results": {"type": "integer", "description": "Max file results (default 20, max 50)"}
            },
            "required": ["pattern"]
        }),
    }
}

pub async fn execute(call: &ToolCall, workspace_dir: Option<&str>) -> Result<String, String> {
    let pattern = call.input["pattern"].as_str().unwrap_or("").to_string();
    if pattern.is_empty() {
        return Err("pattern is required".into());
    }

    let max = (call.input["max_results"].as_u64().unwrap_or(20) as usize).min(MAX_MATCHES);

    let search_path = if let Some(p) = call.input["path"].as_str().filter(|s| !s.is_empty()) {
        if let Some(ws) = workspace_dir {
            super::check_workspace(ws, p)?;
        }
        p.to_string()
    } else {
        workspace_dir.unwrap_or(".").to_string()
    };

    let pat_lower = pattern.to_lowercase();
    let mut matches: Vec<String> = Vec::new();
    search_dir(Path::new(&search_path), &pat_lower, &mut matches, max)?;

    if matches.is_empty() {
        Ok(format!("No matches found for: {pattern}"))
    } else {
        Ok(format!("{} match(es):\n{}", matches.len(), matches.join("\n")))
    }
}

fn search_dir(dir: &Path, pattern: &str, out: &mut Vec<String>, max: usize) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if out.len() >= max {
            break;
        }
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.starts_with('.') || matches!(name, "node_modules" | "target" | ".git") {
            continue;
        }
        if path.is_dir() {
            search_dir(&path, pattern, out, max)?;
        } else if path.is_file() {
            if let Ok(meta) = path.metadata() {
                if meta.len() > MAX_FILE_SIZE {
                    continue;
                }
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                let hits: Vec<String> = content
                    .lines()
                    .enumerate()
                    .filter(|(_, line)| line.to_lowercase().contains(pattern))
                    .take(3)
                    .map(|(i, line)| format!("  L{}: {}", i + 1, line.trim()))
                    .collect();
                if !hits.is_empty() {
                    out.push(format!("{}:\n{}", path.display(), hits.join("\n")));
                }
            }
        }
    }
    Ok(())
}
