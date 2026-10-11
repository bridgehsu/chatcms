pub mod commands;
pub mod repository;

mod service;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};
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

/// 任务中的脚本步骤（从工作流 script 节点抽出）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskScriptStep {
    pub code: String,
    pub label: String,
    /// 是否把上一步输出作为本步 input
    #[serde(default = "default_true")]
    pub pass_output: bool,
}

/// 可供会话 / 插件 @ 的任务摘要。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MentionableTask {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub steps: Vec<TaskScriptStep>,
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
            label: "手动 / @任务".into(),
            x: 120.0,
            y: 160.0,
            data: serde_json::json!({
                "mode": "manual",
                "cron": "0 9 * * *",
                "note": "会话或插件 @ 此任务时从这里开始"
            }),
        }],
        edges: vec![],
    }
}

/// 按触发器出边顺序抽出 script 节点；无连线时按 x 坐标排序。
pub fn extract_script_chain(workflow: &WorkflowGraph) -> Vec<TaskScriptStep> {
    let script_nodes: Vec<&WorkflowNode> = workflow
        .nodes
        .iter()
        .filter(|n| n.node_type == "script")
        .collect();
    if script_nodes.is_empty() {
        return Vec::new();
    }

    let mut outgoing: HashMap<&str, Vec<&str>> = HashMap::new();
    for e in &workflow.edges {
        outgoing
            .entry(e.source.as_str())
            .or_default()
            .push(e.target.as_str());
    }

    let triggers: Vec<&str> = workflow
        .nodes
        .iter()
        .filter(|n| n.node_type == "trigger")
        .map(|n| n.id.as_str())
        .collect();

    let mut ordered_ids: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    if !triggers.is_empty() {
        let mut q: VecDeque<&str> = triggers.into_iter().collect();
        while let Some(id) = q.pop_front() {
            if let Some(nexts) = outgoing.get(id) {
                for &tid in nexts {
                    if !seen.insert(tid.to_string()) {
                        continue;
                    }
                    q.push_back(tid);
                    if workflow
                        .nodes
                        .iter()
                        .any(|n| n.id == tid && n.node_type == "script")
                    {
                        ordered_ids.push(tid.to_string());
                    }
                }
            }
        }
    }

    if ordered_ids.is_empty() {
        let mut by_x: Vec<&WorkflowNode> = script_nodes;
        by_x.sort_by(|a, b| {
            a.x
                .partial_cmp(&b.x)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        });
        ordered_ids = by_x.into_iter().map(|n| n.id.clone()).collect();
    }

    ordered_ids
        .into_iter()
        .filter_map(|id| {
            let n = workflow.nodes.iter().find(|n| n.id == id)?;
            step_from_node(n)
        })
        .collect()
}

fn step_from_node(n: &WorkflowNode) -> Option<TaskScriptStep> {
    let code = n
        .data
        .get("code")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_uppercase();
    let pass_output = n
        .data
        .get("pass_output")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let label = if n.label.trim().is_empty() {
        code.clone()
    } else {
        n.label.trim().to_string()
    };
    Some(TaskScriptStep {
        code,
        label,
        pass_output,
    })
}

pub use service::{list, get, add, update_meta, save_workflow, remove, list_mentionable_tasks};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_chain_follows_edges() {
        let n_t = "t1".to_string();
        let n_a = "s1".to_string();
        let n_b = "s2".to_string();
        let g = WorkflowGraph {
            nodes: vec![
                WorkflowNode {
                    id: n_t.clone(),
                    node_type: "trigger".into(),
                    label: "触发".into(),
                    x: 0.0,
                    y: 0.0,
                    data: serde_json::json!({}),
                },
                WorkflowNode {
                    id: n_a.clone(),
                    node_type: "script".into(),
                    label: "采集".into(),
                    x: 200.0,
                    y: 0.0,
                    data: serde_json::json!({"code": "JOB_A", "pass_output": true}),
                },
                WorkflowNode {
                    id: n_b.clone(),
                    node_type: "script".into(),
                    label: "填入".into(),
                    x: 400.0,
                    y: 0.0,
                    data: serde_json::json!({"code": "JOB_B", "pass_output": true}),
                },
            ],
            edges: vec![
                WorkflowEdge {
                    id: "e1".into(),
                    source: n_t,
                    target: n_a.clone(),
                    source_handle: None,
                    target_handle: None,
                },
                WorkflowEdge {
                    id: "e2".into(),
                    source: n_a,
                    target: n_b,
                    source_handle: None,
                    target_handle: None,
                },
            ],
        };
        let steps = extract_script_chain(&g);
        assert_eq!(steps.len(), 2);
        assert_eq!(steps[0].code, "JOB_A");
        assert_eq!(steps[1].code, "JOB_B");
    }
}
