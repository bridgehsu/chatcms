use serde_json::Value;
use tauri::AppHandle;
use uuid::Uuid;

use super::seed::ensure_seeded;
use super::types::{now_ms, validate_name, Skill, SkillSource};

pub fn list(app: &AppHandle) -> Vec<Skill> {
    let mut list = ensure_seeded(app);
    list.sort_by(|a, b| {
        b.enabled
            .cmp(&a.enabled)
            .then(b.updated_at.cmp(&a.updated_at))
            .then(a.name.cmp(&b.name))
    });
    list
}

pub fn add(
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

    let mut list = ensure_seeded(app);
    if list.iter().any(|s| s.name == name) {
        return Err(format!("已存在同名技能「{name}」"));
    }

    let ts = now_ms();
    let skill = Skill {
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
    list.push(skill.clone());
    crate::persist::save_skills(app, &list);
    Ok(skill)
}

pub fn update(
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

    let mut list = ensure_seeded(app);
    if list.iter().any(|s| s.name == name && s.id != id) {
        return Err(format!("已存在同名技能「{name}」"));
    }

    let skill = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "技能不存在".to_string())?;

    // 内置技能允许编辑内容，但 source 保持 bundled
    skill.name = name;
    skill.description = description;
    skill.body = body;
    skill.enabled = enabled;
    skill.user_invocable = user_invocable;
    skill.disable_model_invocation = disable_model_invocation;
    skill.homepage = homepage.filter(|s| !s.trim().is_empty());
    if metadata.is_some() {
        skill.metadata = metadata;
    }
    skill.updated_at = now_ms();
    let out = skill.clone();
    crate::persist::save_skills(app, &list);
    Ok(out)
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = ensure_seeded(app);
    let Some(skill) = list.iter().find(|s| s.id == id) else {
        return Err("技能不存在".into());
    };
    if skill.source == SkillSource::Bundled {
        return Err("内置技能不能删除，可停用".into());
    }
    list.retain(|s| s.id != id);
    crate::persist::save_skills(app, &list);
    Ok(())
}
