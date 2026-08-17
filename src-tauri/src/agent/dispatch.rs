//! 工具路由：按工具名分发到子 Agent、MCP 或内置实现。

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::permission::{
    self, append_audit, make_audit, AuditDecision, RememberScope, SessionGrant, Verdict,
};
use crate::tools;

use crate::permission::request_permission;
use super::state::AgentState;
use super::subagent::run_sub_agent;

/// 主 Agent 工具分发：权限裁决 → spawn / MCP / 内置 tools。
pub async fn dispatch_tool(
    tc: &tools::ToolCall,
    app: &AppHandle,
    state: &State<'_, AgentState>,
    session_id: &str,
    workspace_dir: Option<&str>,
) -> tools::ToolResult {
    let (cfg, agent_overrides, agent_id) = {
        let config = state.config.lock().unwrap();
        let agents = state.agents.lock().unwrap();
        let active_id = config.active_agent_id.as_deref();
        let default = active_id
            .and_then(|id| agents.iter().find(|a| a.id == id && a.enabled))
            .or_else(|| agents.iter().find(|a| a.enabled));
        let overrides = default.map(|a| a.perms.clone());
        let id = default.map(|a| a.id.clone());
        (config.permission.clone(), overrides, id)
    };

    let outcome = {
        let grants = state.session_grants.lock().unwrap();
        permission::authorize(
            &permission::AuthzContext {
                cfg: &cfg,
                grants: &grants,
                session_id,
                agent_id: agent_id.as_deref(),
                agent_overrides: agent_overrides.as_ref(),
            },
            tc,
        )
    };

    let mode_name = cfg.active_mode_name();
    let domain = outcome.domain;
    let summary = outcome.input_summary.clone();
    let mcp_server = outcome.mcp_server.clone();

    let allowed = match outcome.verdict {
        Verdict::Allow => {
            append_audit(
                app,
                make_audit(
                    session_id,
                    agent_id.as_deref(),
                    domain,
                    &tc.name,
                    &summary,
                    if outcome.grant_used {
                        AuditDecision::AllowUser
                    } else {
                        AuditDecision::AllowAuto
                    },
                    &mode_name,
                    outcome.grant_used,
                ),
            );
            true
        }
        Verdict::Deny { reason } => {
            let decision = if reason.contains("denylist") || reason.contains("allowlist") {
                AuditDecision::DenyConstraint
            } else if outcome.grant_used {
                AuditDecision::DenyUser
            } else {
                AuditDecision::DenyPolicy
            };
            append_audit(
                app,
                make_audit(
                    session_id,
                    agent_id.as_deref(),
                    domain,
                    &tc.name,
                    &summary,
                    decision,
                    &mode_name,
                    outcome.grant_used,
                ),
            );
            return tools::ToolResult {
                id: tc.id.clone(),
                content: reason,
                is_error: true,
            };
        }
        Verdict::Ask => {
            let reply =
                request_permission(app, state, session_id, tc, domain, &summary).await;

            // 超时：remember=Once 且 allowed=false
            let decision = if !reply.allowed && matches!(reply.remember, RememberScope::Once) {
                // 无法区分超时与手动拒绝；记 deny_user（超时也是拒绝）
                AuditDecision::DenyUser
            } else if reply.allowed {
                AuditDecision::AllowUser
            } else {
                AuditDecision::DenyUser
            };

            if matches!(
                reply.remember,
                RememberScope::SessionAllow | RememberScope::SessionDeny
            ) {
                let mut grants = state.session_grants.lock().unwrap();
                grants.add(SessionGrant {
                    session_id: session_id.to_string(),
                    domain,
                    tool_name: Some(tc.name.clone()),
                    mcp_server: mcp_server.clone(),
                    allow: matches!(reply.remember, RememberScope::SessionAllow),
                });
            }

            append_audit(
                app,
                make_audit(
                    session_id,
                    agent_id.as_deref(),
                    domain,
                    &tc.name,
                    &summary,
                    decision,
                    &mode_name,
                    false,
                ),
            );

            if !reply.allowed {
                return tools::ToolResult {
                    id: tc.id.clone(),
                    content: "User denied permission.".to_string(),
                    is_error: true,
                };
            }
            true
        }
    };

    if !allowed {
        return tools::ToolResult {
            id: tc.id.clone(),
            content: "Permission denied.".to_string(),
            is_error: true,
        };
    }

    if tc.name == "spawn_agent" {
        return dispatch_spawn_agent(tc, app, session_id).await;
    }

    if state.mcp.lock().await.is_mcp_tool(&tc.name) {
        return dispatch_mcp_tool(tc, state).await;
    }

    tools::execute(tc, workspace_dir).await
}

async fn dispatch_spawn_agent(
    tc: &tools::ToolCall,
    app: &AppHandle,
    session_id: &str,
) -> tools::ToolResult {
    let prompt = tc.input["prompt"].as_str().unwrap_or("").to_string();
    let agent_key = tc.input["agent"].as_str().map(str::trim).filter(|s| !s.is_empty());
    let override_sys = tc.input["system_prompt"].as_str().map(String::from);

    let (sys, label, sub_workspace) = if let Some(key) = agent_key {
        match crate::agents::service::find_by_slug_or_id(app, key).await {
            Some(profile) if profile.enabled && profile.spawnable => {
                let mut blocks = vec![crate::agents::format_persona(&profile)];
                let skills = {
                    let s = app.state::<AgentState>();
                    let list = s.skills.lock().unwrap().clone();
                    list
                };
                let allowlist = profile.skills.as_ref().map(|v| v.as_slice());
                let skill_prompt =
                    crate::scripts::format_for_prompt(&skills, &prompt, allowlist);
                if !skill_prompt.is_empty() {
                    blocks.push(skill_prompt);
                }
                let ws = profile.workspace_dir.clone();
                (
                    Some(blocks.join("\n\n")),
                    format!("{} ({})", profile.name, profile.slug),
                    ws,
                )
            }
            Some(_) => (
                override_sys.clone(),
                format!("agent `{key}` disabled or not allowed as subagent"),
                None,
            ),
            None => (override_sys.clone(), format!("unknown agent `{key}`"), None),
        }
    } else {
        (override_sys, "adhoc".into(), None)
    };

    let _ = app.emit(
        "subagent-start",
        json!({
            "parent_session_id": session_id,
            "task_id": &tc.id,
            "prompt": &prompt,
            "agent": label,
        }),
    );

    let result_text = match run_sub_agent(app.clone(), sys, prompt, sub_workspace).await {
        Ok(text) => text,
        Err(e) => format!("[sub-agent error] {e}"),
    };

    let _ = app.emit(
        "subagent-done",
        json!({ "parent_session_id": session_id, "task_id": &tc.id }),
    );

    tools::ToolResult {
        id: tc.id.clone(),
        content: result_text,
        is_error: false,
    }
}

async fn dispatch_mcp_tool(
    tc: &tools::ToolCall,
    state: &State<'_, AgentState>,
) -> tools::ToolResult {
    let mcp = state.mcp.lock().await;
    match mcp.call_tool(&tc.name, tc.input.clone()).await {
        Ok(text) => tools::ToolResult {
            id: tc.id.clone(),
            content: text,
            is_error: false,
        },
        Err(e) => tools::ToolResult {
            id: tc.id.clone(),
            content: e.to_string(),
            is_error: true,
        },
    }
}

/// 子 Agent 工具分发：同样走权限裁决（使用父 session_id）。
pub async fn dispatch_sub_tool(
    tc: &tools::ToolCall,
    app: &AppHandle,
    mcp_tool_names: &[String],
    workspace_dir: Option<&str>,
) -> tools::ToolResult {
    let s = app.state::<AgentState>();
    // 子 agent 无独立 session，用占位 id 走策略但不污染主会话 grants
    let session_id = format!("subagent:{}", tc.id);

    if mcp_tool_names.iter().any(|n| n == &tc.name) || !tc.name.starts_with("mcp__") {
        // 复用主分发逻辑的权限部分：简化为 authorize + 对 ask 自动 deny（子 agent 不弹窗）
        let cfg = s.config.lock().unwrap().permission.clone();
        let outcome = {
            let grants = s.session_grants.lock().unwrap();
            permission::authorize(
                &permission::AuthzContext {
                    cfg: &cfg,
                    grants: &grants,
                    session_id: &session_id,
                    agent_id: None,
                    agent_overrides: None,
                },
                tc,
            )
        };

        match outcome.verdict {
            Verdict::Allow => {}
            Verdict::Deny { reason } => {
                append_audit(
                    app,
                    make_audit(
                        &session_id,
                        None,
                        outcome.domain,
                        &tc.name,
                        &outcome.input_summary,
                        AuditDecision::DenyPolicy,
                        &cfg.active_mode_name(),
                        false,
                    ),
                );
                return tools::ToolResult {
                    id: tc.id.clone(),
                    content: reason,
                    is_error: true,
                };
            }
            Verdict::Ask => {
                // 子 agent 无法弹窗：需确认的操作一律拒绝
                append_audit(
                    app,
                    make_audit(
                        &session_id,
                        None,
                        outcome.domain,
                        &tc.name,
                        &outcome.input_summary,
                        AuditDecision::DenyPolicy,
                        &cfg.active_mode_name(),
                        false,
                    ),
                );
                return tools::ToolResult {
                    id: tc.id.clone(),
                    content: "Sub-agent cannot prompt for permission; denied.".into(),
                    is_error: true,
                };
            }
        }
    }

    if mcp_tool_names.iter().any(|n| n == &tc.name) {
        let mcp = s.mcp.lock().await;
        return match mcp.call_tool(&tc.name, tc.input.clone()).await {
            Ok(text) => tools::ToolResult {
                id: tc.id.clone(),
                content: text,
                is_error: false,
            },
            Err(e) => tools::ToolResult {
                id: tc.id.clone(),
                content: e.to_string(),
                is_error: true,
            },
        };
    }

    tools::execute(tc, workspace_dir).await
}
