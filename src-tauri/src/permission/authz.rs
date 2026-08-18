use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::tools::ToolCall;

use super::config::PermissionConfig;
use super::grants::SessionGrantStore;
use super::types::{Domain, DomainPolicy, Verdict};

pub fn domain_for_tool(tool_name: &str) -> Domain {
    if tool_name == "read_file" {
        Domain::FileRead
    } else if tool_name == "write_file" {
        Domain::FileWrite
    } else if tool_name == "bash" {
        Domain::Shell
    } else if tool_name == "spawn_agent" {
        Domain::Agent
    } else if tool_name.starts_with("mcp__") {
        Domain::Mcp
    } else {
        // 未知内置工具：保守按 shell 对待（需确认）
        Domain::Shell
    }
}

pub fn mcp_server_from_tool(tool_name: &str) -> Option<String> {
    // mcp__server__tool
    let rest = tool_name.strip_prefix("mcp__")?;
    let (server, _) = rest.split_once("__")?;
    if server.is_empty() {
        None
    } else {
        Some(server.to_string())
    }
}

fn summarize_input(tc: &ToolCall) -> String {
    let s = match tc.name.as_str() {
        "bash" => tc.input.get("command").or_else(|| tc.input.get("cmd")),
        "read_file" | "write_file" => tc.input.get("path").or_else(|| tc.input.get("file_path")),
        "spawn_agent" => tc.input.get("prompt"),
        _ => None,
    };
    let raw = s
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            let j = tc.input.to_string();
            if j.len() > 200 {
                format!("{}…", &j[..200])
            } else {
                j
            }
        });
    if raw.chars().count() > 240 {
        let t: String = raw.chars().take(240).collect();
        format!("{t}…")
    } else {
        raw
    }
}

fn path_allowed(path: &str, allowlist: &[String]) -> bool {
    if allowlist.is_empty() {
        return true;
    }
    let p = PathBuf::from(path);
    let canon = std::fs::canonicalize(&p).unwrap_or(p);
    allowlist.iter().any(|root| {
        let r = PathBuf::from(root);
        let r = std::fs::canonicalize(&r).unwrap_or(r);
        canon.starts_with(&r) || Path::new(path).starts_with(Path::new(root))
    })
}

fn shell_denied(command: &str, denylist: &[String]) -> bool {
    let lower = command.to_lowercase();
    denylist
        .iter()
        .any(|pat| !pat.is_empty() && lower.contains(&pat.to_lowercase()))
}

/// 合并当前激活模式域策略、MCP server 覆盖、Agent 覆盖。
pub fn resolve_policy(
    cfg: &PermissionConfig,
    domain: Domain,
    mcp_server: Option<&str>,
    agent_overrides: Option<&HashMap<String, DomainPolicy>>,
) -> DomainPolicy {
    let mut policy = cfg.domain_policy(domain);

    if domain == Domain::Mcp {
        if let Some(server) = mcp_server {
            if let Some(p) = cfg.mcp_servers.get(server) {
                policy = *p;
            }
        }
    }

    if let Some(over) = agent_overrides {
        if let Some(p) = over.get(domain.as_str()) {
            policy = *p;
        }
    }

    policy
}

pub struct AuthzContext<'a> {
    pub cfg: &'a PermissionConfig,
    pub grants: &'a SessionGrantStore,
    pub session_id: &'a str,
    #[allow(dead_code)]
    pub agent_id: Option<&'a str>,
    pub agent_overrides: Option<&'a HashMap<String, DomainPolicy>>,
}

pub struct AuthzOutcome {
    pub domain: Domain,
    pub mcp_server: Option<String>,
    pub verdict: Verdict,
    pub grant_used: bool,
    pub input_summary: String,
}

/// 裁决：会话例外 → 约束 → 策略。
pub fn authorize(ctx: &AuthzContext<'_>, tc: &ToolCall) -> AuthzOutcome {
    let domain = domain_for_tool(&tc.name);
    let mcp_server = mcp_server_from_tool(&tc.name);
    let input_summary = summarize_input(tc);

    // 1) Session grant
    if let Some(g) = ctx
        .grants
        .find(ctx.session_id, domain, &tc.name, mcp_server.as_deref())
    {
        let verdict = if g.allow {
            Verdict::Allow
        } else {
            Verdict::Deny {
                reason: "Denied by session grant.".into(),
            }
        };
        return AuthzOutcome {
            domain,
            mcp_server,
            verdict,
            grant_used: true,
            input_summary,
        };
    }

    // 2) Hard constraints
    if domain == Domain::Shell {
        let cmd = tc
            .input
            .get("command")
            .or_else(|| tc.input.get("cmd"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if shell_denied(cmd, &ctx.cfg.shell_command_deny) {
            return AuthzOutcome {
                domain,
                mcp_server,
                verdict: Verdict::Deny {
                    reason: "Command blocked by shell denylist.".into(),
                },
                grant_used: false,
                input_summary,
            };
        }
    }
    if domain == Domain::FileWrite {
        let path = tc
            .input
            .get("path")
            .or_else(|| tc.input.get("file_path"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if !path_allowed(path, &ctx.cfg.write_path_allowlist) {
            return AuthzOutcome {
                domain,
                mcp_server,
                verdict: Verdict::Deny {
                    reason: "Path not in write allowlist.".into(),
                },
                grant_used: false,
                input_summary,
            };
        }
    }

    // 3) Policy
    let policy = resolve_policy(
        ctx.cfg,
        domain,
        mcp_server.as_deref(),
        ctx.agent_overrides,
    );

    let verdict = match policy {
        DomainPolicy::Allow => Verdict::Allow,
        DomainPolicy::Deny => Verdict::Deny {
            reason: format!("Denied by policy ({}).", domain.as_str()),
        },
        DomainPolicy::Ask => Verdict::Ask,
    };

    AuthzOutcome {
        domain,
        mcp_server,
        verdict,
        grant_used: false,
        input_summary,
    }
}
