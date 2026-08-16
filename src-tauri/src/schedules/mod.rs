pub mod commands;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkflowGraph {
    #[serde(default)]
    pub nodes: Vec<WorkflowNode>,
    #[serde(default)]
    pub edges: Vec<WorkflowEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleProject {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub workflow: WorkflowGraph,
    pub updated: i64,
    pub created: i64,
}

fn default_true() -> bool {
    true
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn default_workflow() -> WorkflowGraph {
    WorkflowGraph {
        nodes: vec![WorkflowNode {
            id: format!("n_{}", Uuid::new_v4()),
            node_type: "trigger".into(),
            label: "定时触发".into(),
            x: 120.0,
            y: 160.0,
            data: serde_json::json!({
                "mode": "cron",
                "cron": "0 9 * * *",
                "note": "每天 09:00"
            }),
        }],
        edges: vec![],
    }
}

pub fn list(app: &AppHandle) -> Vec<ScheduleProject> {
    let mut list = crate::persist::load_schedule_projects(app);
    list.sort_by(|a, b| b.updated.cmp(&a.updated));
    list
}

pub fn get(app: &AppHandle, id: &str) -> Result<ScheduleProject, String> {
    crate::persist::load_schedule_projects(app)
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

    let mut list = crate::persist::load_schedule_projects(app);
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
    crate::persist::save_schedule_projects(app, &list);
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

    let mut list = crate::persist::load_schedule_projects(app);
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
    crate::persist::save_schedule_projects(app, &list);
    Ok(out)
}

pub fn save_workflow(
    app: &AppHandle,
    id: String,
    workflow: WorkflowGraph,
) -> Result<ScheduleProject, String> {
    let mut list = crate::persist::load_schedule_projects(app);
    let project = list
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "项目不存在".to_string())?;
    project.workflow = workflow;
    project.updated = now_ms();
    let out = project.clone();
    crate::persist::save_schedule_projects(app, &list);
    Ok(out)
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = crate::persist::load_schedule_projects(app);
    let before = list.len();
    list.retain(|p| p.id != id);
    if list.len() == before {
        return Err("项目不存在".into());
    }
    crate::persist::save_schedule_projects(app, &list);
    Ok(())
}
