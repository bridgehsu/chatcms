//! 会话 @ 附件：脚本 / 任务 / Skill / MCP（结构化，不靠意图猜类型）。

use serde::{Deserialize, Serialize};

/// `script` | `task` | `skill` | `mcp`
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentKind {
    Script,
    Task,
    Skill,
    Mcp,
}

impl AttachmentKind {
    #[allow(dead_code)]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Script => "script",
            Self::Task => "task",
            Self::Skill => "skill",
            Self::Mcp => "mcp",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "script" => Some(Self::Script),
            "task" => Some(Self::Task),
            "skill" => Some(Self::Skill),
            "mcp" => Some(Self::Mcp),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatAttachment {
    /// script | task | skill | mcp（兼容前端传 kind 字符串）
    pub kind: String,
    /// 稳定 id：脚本 platform_id/key、任务项目 id、技能 name、MCP server name
    pub id: String,
    pub label: String,
    /// 脚本编码（kind=script 时）
    #[serde(default)]
    pub code: Option<String>,
}

impl ChatAttachment {
    pub fn kind_enum(&self) -> Option<AttachmentKind> {
        AttachmentKind::parse(&self.kind)
    }

    pub fn normalize(list: Vec<Self>) -> Vec<Self> {
        let mut out = Vec::new();
        for mut a in list {
            a.kind = a.kind.trim().to_ascii_lowercase();
            a.id = a.id.trim().to_string();
            a.label = a.label.trim().to_string();
            if a.id.is_empty() || AttachmentKind::parse(&a.kind).is_none() {
                continue;
            }
            if a.label.is_empty() {
                a.label = a.id.clone();
            }
            if let Some(c) = a.code.as_mut() {
                let t = c.trim().to_string();
                if t.is_empty() {
                    a.code = None;
                } else {
                    *c = t;
                }
            }
            if out
                .iter()
                .any(|x: &ChatAttachment| x.kind == a.kind && x.id == a.id)
            {
                continue;
            }
            out.push(a);
        }
        out
    }
}

/// 写入 system prompt，供模型区分引用类型。
pub fn format_for_prompt(attachments: &[ChatAttachment]) -> Option<String> {
    if attachments.is_empty() {
        return None;
    }
    let mut lines = vec![
        "<user_attachments>".into(),
        "The user explicitly @-mentioned the following. Treat type as ground truth (do not reclassify).".into(),
        "· skill — follow that skill's workflow in your reply.".into(),
        "· mcp — prefer tools from that MCP server when needed.".into(),
        "· script — browser page script; system may pre-run run_page_script.".into(),
        "· task — schedule workflow that chains multiple page scripts; system may pre-run the chain.".into(),
        "".into(),
    ];
    for a in attachments {
        let code = a
            .code
            .as_deref()
            .filter(|c| !c.is_empty())
            .map(|c| format!(" code={c}"))
            .unwrap_or_default();
        lines.push(format!(
            "- type={} id={} label={}{}",
            a.kind, a.id, a.label, code
        ));
    }
    lines.push("</user_attachments>".into());
    Some(lines.join("\n"))
}

pub fn skill_names(attachments: &[ChatAttachment]) -> Vec<String> {
    attachments
        .iter()
        .filter(|a| a.kind_enum() == Some(AttachmentKind::Skill))
        .map(|a| a.id.clone())
        .collect()
}

pub fn mcp_names(attachments: &[ChatAttachment]) -> Vec<String> {
    attachments
        .iter()
        .filter(|a| a.kind_enum() == Some(AttachmentKind::Mcp))
        .map(|a| a.id.clone())
        .collect()
}

#[allow(dead_code)]
pub fn script_codes(attachments: &[ChatAttachment]) -> Vec<String> {
    scripts(attachments)
        .into_iter()
        .filter_map(|a| {
            a.code
                .clone()
                .or_else(|| Some(a.id.clone()))
                .filter(|s| !s.is_empty())
        })
        .collect()
}

/// 本轮 @ 的脚本附件。
pub fn scripts(attachments: &[ChatAttachment]) -> Vec<&ChatAttachment> {
    attachments
        .iter()
        .filter(|a| a.kind_enum() == Some(AttachmentKind::Script))
        .collect()
}

/// 本轮 @ 的任务附件。
pub fn tasks(attachments: &[ChatAttachment]) -> Vec<&ChatAttachment> {
    attachments
        .iter()
        .filter(|a| a.kind_enum() == Some(AttachmentKind::Task))
        .collect()
}

/// 脚本动作写入 prompt，约束模型勿重复调用或误执行。
pub fn format_script_action_for_prompt(
    action: &str,
    scripts: &[&ChatAttachment],
    pre_ran: bool,
) -> Option<String> {
    if scripts.is_empty() {
        return None;
    }
    let names: Vec<&str> = scripts.iter().map(|s| s.label.as_str()).collect();
    let mut lines = vec![
        "<script_action>".into(),
        format!("action: {action}"),
        format!("scripts: {}", names.join(", ")),
    ];
    match action {
        "explain" => {
            lines.push(
                "Do NOT call run_page_script. Only explain what the script is for and how to use it."
                    .into(),
            );
        }
        "ask" => {
            lines.push(
                "Do NOT call run_page_script. Ask the user whether to execute or only learn about the script."
                    .into(),
            );
        }
        "execute" if pre_ran => {
            lines.push(
                "The page script was ALREADY executed by the system. Do NOT call run_page_script again. Use <script_run_result> below to answer; say clearly whether it succeeded and summarize useful output."
                    .into(),
            );
        }
        "execute" => {
            lines.push(
                "Call run_page_script with the script code. Prefer the @-mentioned script. After it returns, summarize for the user."
                    .into(),
            );
        }
        _ => {}
    }
    lines.push("</script_action>".into());
    Some(lines.join("\n"))
}

pub fn format_task_action_for_prompt(
    action: &str,
    tasks: &[&ChatAttachment],
    step_labels: &[String],
    pre_ran: bool,
) -> Option<String> {
    if tasks.is_empty() {
        return None;
    }
    let names: Vec<&str> = tasks.iter().map(|t| t.label.as_str()).collect();
    let mut lines = vec![
        "<task_action>".into(),
        format!("action: {action}"),
        format!("tasks: {}", names.join(", ")),
    ];
    if !step_labels.is_empty() {
        lines.push(format!("steps: {}", step_labels.join(" → ")));
    }
    match action {
        "explain" => {
            lines.push(
                "Do NOT call run_page_script. Explain this task workflow and its script steps."
                    .into(),
            );
        }
        "ask" => {
            lines.push(
                "Do NOT call run_page_script. Clarify whether to run the task or only learn about it."
                    .into(),
            );
        }
        "execute" if pre_ran => {
            lines.push(
                "The task script chain was ALREADY executed. Do NOT call run_page_script again. Use <task_run_result> to summarize."
                    .into(),
            );
        }
        "execute" => {
            lines.push(
                "This is a multi-script task; prefer letting the system run the chain."
                    .into(),
            );
        }
        _ => {}
    }
    lines.push("</task_action>".into());
    Some(lines.join("\n"))
}
