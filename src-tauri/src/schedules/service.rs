use tauri::AppHandle;
use uuid::Uuid;

use super::{
    MentionableTask, ScheduleProject, WorkflowGraph, default_workflow, extract_script_chain,
    now_ms,
};
use super::repository as repo;

pub fn list(app: &AppHandle) -> Vec<ScheduleProject> {
    let mut list = repo::load_all(app);
    list.sort_by(|a, b| b.updated.cmp(&a.updated));
    list
}

pub fn get(app: &AppHandle, id: &str) -> Result<ScheduleProject, String> {
    repo::load_all(app)
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "项目不存在".into())
}

pub fn add(
    app: &AppHandle,
    name: String,
    description: String,
    enabled: bool,
) -> Result<ScheduleProject, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("项目名称不能为空".into());
    }

    let mut list = repo::load_all(app);
    if list.iter().any(|p| p.name == name) {
        return Err(format!("已存在同名项目「{name}」"));
    }

    let ts = now_ms();
    let project = ScheduleProject {
        id: Uuid::new_v4().to_string(),
        name,
        description: description.trim().to_string(),
        enabled,
        workflow: default_workflow(),
        updated: ts,
        created: ts,
    };
    list.push(project.clone());
    repo::save_all(app, &list);
    Ok(project)
}

pub fn update_meta(
    app: &AppHandle,
    id: String,
    name: String,
    description: String,
    enabled: bool,
) -> Result<ScheduleProject, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("项目名称不能为空".into());
    }

    let mut list = repo::load_all(app);
    if list.iter().any(|p| p.name == name && p.id != id) {
        return Err(format!("已存在同名项目「{name}」"));
    }

    let project = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "项目不存在".to_string())?;
    project.name = name;
    project.description = description.trim().to_string();
    project.enabled = enabled;
    project.updated = now_ms();
    let out = project.clone();
    repo::save_all(app, &list);
    Ok(out)
}

pub fn save_workflow(
    app: &AppHandle,
    id: String,
    workflow: WorkflowGraph,
) -> Result<ScheduleProject, String> {
    let mut list = repo::load_all(app);
    let project = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "项目不存在".to_string())?;
    project.workflow = workflow;
    project.updated = now_ms();
    let out = project.clone();
    repo::save_all(app, &list);
    Ok(out)
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = repo::load_all(app);
    let before = list.len();
    list.retain(|p| p.id != id);
    if list.len() == before {
        return Err("项目不存在".into());
    }
    repo::save_all(app, &list);
    Ok(())
}

/// 启用且含脚本步骤的任务，供插件 / 会话 @。
pub fn list_mentionable_tasks(app: &AppHandle) -> Vec<MentionableTask> {
    list(app)
        .into_iter()
        .filter(|p| p.enabled)
        .filter_map(|p| {
            let steps = extract_script_chain(&p.workflow);
            if steps.is_empty() {
                return None;
            }
            Some(MentionableTask {
                id: p.id,
                name: p.name,
                description: p.description,
                steps,
            })
        })
        .collect()
}
