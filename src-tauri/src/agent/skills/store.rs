use serde_json::Value;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::types::{now_ms, validate_name, Skill, SkillSource};

fn skills_dir(app: &AppHandle, source: &str) -> std::path::PathBuf {
    let base = app.path().app_data_dir().unwrap_or_default().join("skills").join(source);
    let _ = std::fs::create_dir_all(&base);
    base
}

/// 把 Skill 写到磁盘 .md 文件，返回写入的路径。
fn write_skill_file(app: &AppHandle, skill: &Skill) -> String {
    let source_dir = match skill.source {
        SkillSource::Bundled => "bundled",
        SkillSource::Managed => "npx",
        SkillSource::Workspace => "manual",
    };
    let dir = skills_dir(app, source_dir);
    let path = dir.join(format!("{}.md", skill.name));
    let content = super::prompt::to_skill_md(skill);
    let _ = std::fs::write(&path, content);
    path.to_string_lossy().to_string()
}

/// 从磁盘删除 .md 文件。
fn delete_skill_file(file_path: &str) {
    if !file_path.is_empty() {
        let _ = std::fs::remove_file(file_path);
    }
}

pub async fn list(app: &AppHandle) -> Vec<Skill> {
    crate::persist::load_all_skills(app).await
}

pub async fn add(
    app: &AppHandle,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<Value>,
) -> Result<Skill, String> {
    let name = validate_name(&name)?;
    let description = description.trim().to_string();
    if description.is_empty() {
        return Err("描述不能为空".into());
    }

    let existing = crate::persist::load_all_skills(app).await;
    if existing.iter().any(|s| s.name == name) {
        return Err(format!("已存在同名技能「{name}」"));
    }

    let ts = now_ms();
    let mut skill = Skill {
        id: Uuid::new_v4().to_string(),
        name,
        description,
        body,
        source: SkillSource::Workspace,
        enabled,
        user_invocable,
        disable_model_invocation,
        homepage: homepage.filter(|s| !s.trim().is_empty()),
        metadata,
        created_at: ts,
        updated_at: ts,
    };

    let file_path = write_skill_file(app, &skill);
    // store file_path in metadata
    let meta = skill.metadata.get_or_insert_with(|| serde_json::json!({}));
    if let Some(obj) = meta.as_object_mut() {
        obj.insert("file_path".into(), serde_json::Value::String(file_path));
    }

    crate::persist::save_skill(app, &skill).await;
    Ok(skill)
}

pub async fn update(
    app: &AppHandle,
    id: String,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<Value>,
) -> Result<Skill, String> {
    let name = validate_name(&name)?;
    let description = description.trim().to_string();
    if description.is_empty() {
        return Err("描述不能为空".into());
    }

    let mut list = crate::persist::load_all_skills(app).await;
    if list.iter().any(|s| s.name == name && s.id != id) {
        return Err(format!("已存在同名技能「{name}」"));
    }

    let skill = list.iter_mut().find(|s| s.id == id)
        .ok_or_else(|| "技能不存在".to_string())?;

    // Delete old file if name changed
    let old_file = skill.metadata.as_ref()
        .and_then(|m| m.get("file_path"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if skill.name != name && !old_file.is_empty() {
        delete_skill_file(&old_file);
    }

    skill.name = name;
    skill.description = description;
    skill.body = body;
    skill.enabled = enabled;
    skill.user_invocable = user_invocable;
    skill.disable_model_invocation = disable_model_invocation;
    skill.homepage = homepage.filter(|s| !s.trim().is_empty());
    if let Some(m) = metadata {
        skill.metadata = Some(m);
    }
    skill.updated_at = now_ms();

    let file_path = write_skill_file(app, skill);
    let meta = skill.metadata.get_or_insert_with(|| serde_json::json!({}));
    if let Some(obj) = meta.as_object_mut() {
        obj.insert("file_path".into(), serde_json::Value::String(file_path));
    }

    let out = skill.clone();
    crate::persist::save_skill(app, &out).await;
    Ok(out)
}

pub async fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let list = crate::persist::load_all_skills(app).await;
    let skill = list.iter().find(|s| s.id == id)
        .ok_or_else(|| "技能不存在".to_string())?;

    if skill.source == SkillSource::Bundled {
        return Err("内置技能不能删除，可停用".into());
    }

    let file_path = skill.metadata.as_ref()
        .and_then(|m| m.get("file_path"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    delete_skill_file(&file_path);

    crate::persist::delete_skill(app, &id).await;
    Ok(())
}

/// npx 安装：执行 shell 命令，扫描写入的 .md 文件，入库。
/// pkg_name 形如 "@chatcms/skill-seo"
pub async fn install_npx(app: &AppHandle, pkg_name: String) -> Result<Vec<Skill>, String> {
    let npx_dir = skills_dir(app, "npx");
    let npx_dir_str = npx_dir.to_string_lossy().to_string();

    // 执行 npx，传入安装目标目录环境变量
    let output = tokio::process::Command::new("npx")
        .arg("--yes")
        .arg(&pkg_name)
        .arg("--install-dir")
        .arg(&npx_dir_str)
        .env("CHATCMS_SKILLS_DIR", &npx_dir_str)
        .output()
        .await
        .map_err(|e| format!("执行 npx 失败: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("npx 安装失败: {stderr}"));
    }

    // 扫描 npx 目录下新增的 .md 文件
    let existing = crate::persist::load_all_skills(app).await;
    let existing_names: std::collections::HashSet<_> = existing.iter().map(|s| s.name.clone()).collect();

    let mut installed = Vec::new();
    let read_dir = std::fs::read_dir(&npx_dir).map_err(|e| e.to_string())?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        let skill = parse_skill_md(&content, &path.to_string_lossy(), &pkg_name);
        if let Some(mut skill) = skill {
            if existing_names.contains(&skill.name) {
                continue; // 已存在跳过
            }
            let meta = skill.metadata.get_or_insert_with(|| serde_json::json!({}));
            if let Some(obj) = meta.as_object_mut() {
                obj.insert("pkg_name".into(), serde_json::Value::String(pkg_name.clone()));
                obj.insert("file_path".into(), serde_json::Value::String(path.to_string_lossy().to_string()));
            }
            crate::persist::save_skill(app, &skill).await;
            installed.push(skill);
        }
    }

    Ok(installed)
}

/// 解析 SKILL.md frontmatter + body → Skill struct。
pub fn parse_skill_md(content: &str, file_path: &str, pkg_name: &str) -> Option<Skill> {
    let content = content.trim();
    if !content.starts_with("---") {
        // 无 frontmatter：用文件名作为 name
        let name = std::path::Path::new(file_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();
        let ts = now_ms();
        return Some(Skill {
            id: Uuid::new_v4().to_string(),
            name,
            description: String::new(),
            body: content.to_string(),
            source: if pkg_name.is_empty() { SkillSource::Workspace } else { SkillSource::Managed },
            enabled: true,
            user_invocable: true,
            disable_model_invocation: false,
            homepage: None,
            metadata: None,
            created_at: ts,
            updated_at: ts,
        });
    }

    let rest = &content[3..];
    let end = rest.find("\n---")?;
    let fm_str = &rest[..end];
    let body = rest[end + 4..].trim().to_string();

    let mut name = String::new();
    let mut description = String::new();
    let mut emoji = String::new();
    let mut homepage = None;
    let mut user_invocable = true;
    let mut disable_model_invocation = false;

    for line in fm_str.lines() {
        if let Some(v) = line.strip_prefix("name:") {
            name = v.trim().trim_matches('"').to_string();
        } else if let Some(v) = line.strip_prefix("description:") {
            description = v.trim().trim_matches('"').to_string();
        } else if let Some(v) = line.strip_prefix("emoji:") {
            emoji = v.trim().to_string();
        } else if let Some(v) = line.strip_prefix("homepage:") {
            homepage = Some(v.trim().to_string());
        } else if let Some(v) = line.strip_prefix("user-invocable:") {
            user_invocable = v.trim() != "false";
        } else if let Some(v) = line.strip_prefix("disable-model-invocation:") {
            disable_model_invocation = v.trim() == "true";
        }
    }

    if name.is_empty() {
        name = std::path::Path::new(file_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();
    }

    let ts = now_ms();
    let metadata = if !emoji.is_empty() || !pkg_name.is_empty() {
        let mut m = serde_json::json!({});
        if !emoji.is_empty() { m["emoji"] = serde_json::Value::String(emoji); }
        if !pkg_name.is_empty() { m["pkg_name"] = serde_json::Value::String(pkg_name.to_string()); }
        Some(m)
    } else {
        None
    };

    Some(Skill {
        id: Uuid::new_v4().to_string(),
        name,
        description,
        body,
        source: if pkg_name.is_empty() { SkillSource::Workspace } else { SkillSource::Managed },
        enabled: true,
        user_invocable,
        disable_model_invocation,
        homepage,
        metadata,
        created_at: ts,
        updated_at: ts,
    })
}
