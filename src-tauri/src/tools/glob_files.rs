use serde_json::json;
use super::types::{ToolCall, ToolDef};
use std::path::Path;

const MAX_FILES: usize = 200;

pub fn def() -> ToolDef {
    ToolDef {
        name: "glob_files".to_string(),
        description: "List files matching a filename pattern in the workspace. Use * as wildcard (e.g. '*.rs', 'test_*.py').".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Filename pattern. * matches any characters within a filename (e.g. '*.rs', 'README*')."},
                "path": {"type": "string", "description": "Directory to search in (default: workspace root)"}
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

    let search_path = if let Some(p) = call.input["path"].as_str().filter(|s| !s.is_empty()) {
        if let Some(ws) = workspace_dir {
            super::check_workspace(ws, p)?;
        }
        p.to_string()
    } else {
        workspace_dir.unwrap_or(".").to_string()
    };

    let mut found: Vec<String> = Vec::new();
    collect_files(Path::new(&search_path), &pattern, &mut found, MAX_FILES)?;
    found.sort();

    if found.is_empty() {
        Ok(format!("No files matching '{pattern}'"))
    } else {
        Ok(format!("{} file(s):\n{}", found.len(), found.join("\n")))
    }
}

/// Simple glob: * matches any sequence within the filename segment.
fn matches_glob(name: &str, pattern: &str) -> bool {
    let n = name.to_lowercase();
    let p = pattern.to_lowercase();
    if !p.contains('*') {
        return n == p;
    }
    let parts: Vec<&str> = p.split('*').collect();
    let mut remaining = n.as_str();
    for (i, part) in parts.iter().enumerate() {
        if part.is_empty() {
            continue;
        }
        if i == 0 {
            if !remaining.starts_with(part) {
                return false;
            }
            remaining = &remaining[part.len()..];
        } else if let Some(pos) = remaining.find(part) {
            remaining = &remaining[pos + part.len()..];
        } else {
            return false;
        }
    }
    // Last segment must align with end of name when pattern doesn't end with *
    if !p.ends_with('*') {
        if let Some(last) = parts.last() {
            if !last.is_empty() && !n.ends_with(last) {
                return false;
            }
        }
    }
    true
}

fn collect_files(dir: &Path, pattern: &str, found: &mut Vec<String>, max: usize) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if found.len() >= max {
            break;
        }
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.starts_with('.') || matches!(name, "node_modules" | "target" | ".git") {
            continue;
        }
        if path.is_dir() {
            collect_files(&path, pattern, found, max)?;
        } else if matches_glob(name, pattern) {
            found.push(path.display().to_string());
        }
    }
    Ok(())
}
