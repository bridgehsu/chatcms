pub mod commands;
pub mod repository;

mod service;

use serde::{Deserialize, Serialize};
use serde_json::Value;
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

pub(crate) fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn default_workflow() -> WorkflowGraph {
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

pub use service::{list, get, add, update_meta, save_workflow, remove};
