//! 权限内核：自定义模式域策略 → 会话例外 → 审计。

pub mod commands;

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::persist;
use crate::tools::ToolCall;

// ── Enums ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunMode {
    /// 观察模式：危险域强制确认或拒绝倾向
    Observe,
    /// 协助模式：默认，严格按域策略
    Assist,
    /// 自动模式：尊重用户把域设为 allow 的自动放行
    Trust,
}

impl Default for RunMode {
    fn default() -> Self {
        Self::Assist
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Domain {
    FileRead,
    FileWrite,
    Shell,
    Mcp,
    Agent,
    Network,
    Browser,
    App,
}

impl Domain {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::FileRead => "file_read",
            Self::FileWrite => "file_write",
            Self::Shell => "shell",
            Self::Mcp => "mcp",
            Self::Agent => "agent",
            Self::Network => "network",
            Self::Browser => "browser",
            Self::App => "app",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::FileRead => "文件读取",
            Self::FileWrite => "文件写入",
            Self::Shell => "终端",
            Self::Mcp => "MCP",
            Self::Agent => "子代理",
            Self::Network => "网络",
            Self::Browser => "浏览器",
            Self::App => "应用",
        }
    }

    pub fn all() -> &'static [Domain] {
        &[
            Self::FileRead,
            Self::FileWrite,
            Self::Shell,
            Self::Mcp,
            Self::Agent,
            Self::Network,
            Self::Browser,
            Self::App,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DomainPolicy {
    Allow,
    Ask,
    Deny,
}

impl Default for DomainPolicy {
    fn default() -> Self {
        Self::Ask
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RememberScope {
    Once,
    SessionAllow,
    SessionDeny,
}

impl Default for RememberScope {
    fn default() -> Self {
        Self::Once
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditDecision {
    AllowAuto,
    AllowUser,
    DenyUser,
    DenyPolicy,
    DenyTimeout,
    DenyConstraint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Allow,
    Deny { reason: String },
    Ask,
}

// ── Config ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionMode {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default = "default_domains")]
    pub domains: HashMap<String, DomainPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionConfig {
    /// 用户自定义 / 预设模式（按 sort_order 排序）
    #[serde(default)]
    pub modes: Vec<PermissionMode>,
    /// 当前会话工具栏选中的模式
    #[serde(default)]
    pub active_mode_id: String,
    /// 兼容旧配置；ensure_defaults 迁移后可忽略
    #[serde(default)]
    pub run_mode: RunMode,
    #[serde(default)]
    pub domains: HashMap<String, DomainPolicy>,
    /// MCP 按 server 覆盖（server 名 → 策略）
    #[serde(default)]
    pub mcp_servers: HashMap<String, DomainPolicy>,
    /// 文件写入允许的路径前缀（空 = 不限制路径，仍受域策略约束）
    #[serde(default)]
    pub write_path_allowlist: Vec<String>,
    /// Shell 命令黑名单子串（命中则 deny_constraint）
    #[serde(default = "default_shell_deny")]
    pub shell_command_deny: Vec<String>,
}

fn default_domains() -> HashMap<String, DomainPolicy> {
    let mut m = HashMap::new();
    m.insert("file_read".into(), DomainPolicy::Allow);
    m.insert("file_write".into(), DomainPolicy::Ask);
    m.insert("shell".into(), DomainPolicy::Ask);
    m.insert("mcp".into(), DomainPolicy::Ask);
    m.insert("agent".into(), DomainPolicy::Ask);
    m.insert("network".into(), DomainPolicy::Deny);
    m.insert("browser".into(), DomainPolicy::Deny);
    m.insert("app".into(), DomainPolicy::Deny);
    m
}

fn observe_domains() -> HashMap<String, DomainPolicy> {
    let mut m = default_domains();
    m.insert("file_write".into(), DomainPolicy::Ask);
    m.insert("shell".into(), DomainPolicy::Ask);
    m.insert("mcp".into(), DomainPolicy::Ask);
    m.insert("agent".into(), DomainPolicy::Ask);
    m
}

fn trust_domains() -> HashMap<String, DomainPolicy> {
    let mut m = default_domains();
    m.insert("file_write".into(), DomainPolicy::Allow);
    m.insert("shell".into(), DomainPolicy::Allow);
    m.insert("mcp".into(), DomainPolicy::Allow);
    m.insert("agent".into(), DomainPolicy::Allow);
    m
}

fn ensure_mode_domains(domains: &mut HashMap<String, DomainPolicy>) {
    for d in Domain::all() {
        domains.entry(d.as_str().to_string()).or_insert_with(|| match d {
            Domain::FileRead => DomainPolicy::Allow,
            Domain::Network | Domain::Browser | Domain::App => DomainPolicy::Deny,
            _ => DomainPolicy::Ask,
        });
    }
}

fn default_shell_deny() -> Vec<String> {
    vec![
        "rm -rf /".into(),
        "mkfs".into(),
        ":(){:|:&};:".into(),
        "dd if=/dev/zero".into(),
    ]
}

fn seed_modes() -> Vec<PermissionMode> {
    vec![
        PermissionMode {
            id: "mode_observe".into(),
            name: "观察模式".into(),
            description: "危险操作需确认".into(),
            sort_order: 0,
            domains: observe_domains(),
        },
        PermissionMode {
            id: "mode_assist".into(),
            name: "协助模式".into(),
            description: "按域策略执行".into(),
            sort_order: 1,
            domains: default_domains(),
        },
        PermissionMode {
            id: "mode_auto".into(),
            name: "自动模式".into(),
            description: "常用能力自动放行".into(),
            sort_order: 2,
            domains: trust_domains(),
        },
    ]
}

impl Default for PermissionConfig {
    fn default() -> Self {
        let modes = seed_modes();
        let active_mode_id = modes
            .first()
            .map(|m| m.id.clone())
            .unwrap_or_default();
        Self {
            modes,
            active_mode_id,
            run_mode: RunMode::Assist,
            domains: default_domains(),
            mcp_servers: HashMap::new(),
            write_path_allowlist: Vec::new(),
            shell_command_deny: default_shell_deny(),
        }
    }
}

impl PermissionConfig {
    pub fn ensure_defaults(&mut self) {
        // 迁移：旧版只有 run_mode + domains
        if self.modes.is_empty() {
            let mut modes = seed_modes();
            if !self.domains.is_empty() {
                if let Some(assist) = modes.iter_mut().find(|m| m.id == "mode_assist") {
                    assist.domains = self.domains.clone();
                    ensure_mode_domains(&mut assist.domains);
                }
            }
            let active = match self.run_mode {
                RunMode::Observe => "mode_observe",
                RunMode::Assist => "mode_assist",
                RunMode::Trust => "mode_auto",
            };
            self.active_mode_id = active.into();
            self.modes = modes;
        }

        for mode in &mut self.modes {
            ensure_mode_domains(&mut mode.domains);
        }

        self.normalize_sort();

        if self.active_mode_id.is_empty()
            || !self.modes.iter().any(|m| m.id == self.active_mode_id)
        {
            self.active_mode_id = self
                .sorted_mode_ids()
                .into_iter()
                .next()
                .unwrap_or_default();
        }

        if self.shell_command_deny.is_empty() {
            self.shell_command_deny = default_shell_deny();
        }
    }

    pub fn normalize_sort(&mut self) {
        let mut indexed: Vec<(usize, i32)> = self
            .modes
            .iter()
            .enumerate()
            .map(|(i, m)| (i, m.sort_order))
            .collect();
        indexed.sort_by(|a, b| a.1.cmp(&b.1).then(a.0.cmp(&b.0)));
        for (order, (idx, _)) in indexed.into_iter().enumerate() {
            if let Some(m) = self.modes.get_mut(idx) {
                m.sort_order = order as i32;
            }
        }
    }

    pub fn sorted_modes(&self) -> Vec<&PermissionMode> {
        let mut v: Vec<&PermissionMode> = self.modes.iter().collect();
        v.sort_by(|a, b| a.sort_order.cmp(&b.sort_order).then(a.name.cmp(&b.name)));
        v
    }

    pub fn sorted_mode_ids(&self) -> Vec<String> {
        self.sorted_modes().into_iter().map(|m| m.id.clone()).collect()
    }

    pub fn active_mode(&self) -> Option<&PermissionMode> {
        self.modes
            .iter()
            .find(|m| m.id == self.active_mode_id)
            .or_else(|| self.sorted_modes().into_iter().next())
    }

    pub fn active_mode_name(&self) -> String {
        self.active_mode()
            .map(|m| m.name.clone())
            .unwrap_or_else(|| "未命名".into())
    }

    pub fn domain_policy(&self, domain: Domain) -> DomainPolicy {
        self.active_mode()
            .and_then(|m| m.domains.get(domain.as_str()).copied())
            .unwrap_or(DomainPolicy::Ask)
    }
}

// ── Session grants ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionGrant {
    pub session_id: String,
    pub domain: Domain,
    /// 可选：仅匹配该工具名
    pub tool_name: Option<String>,
    /// 可选：MCP server 名
    pub mcp_server: Option<String>,
    pub allow: bool,
}

#[derive(Debug, Default)]
pub struct SessionGrantStore {
    grants: Vec<SessionGrant>,
}

impl SessionGrantStore {
    pub fn clear_session(&mut self, session_id: &str) {
        self.grants.retain(|g| g.session_id != session_id);
    }

    pub fn add(&mut self, grant: SessionGrant) {
        self.grants.retain(|g| {
            !(g.session_id == grant.session_id
                && g.domain == grant.domain
                && g.tool_name == grant.tool_name
                && g.mcp_server == grant.mcp_server)
        });
        self.grants.push(grant);
    }

    pub fn find(
        &self,
        session_id: &str,
        domain: Domain,
        tool_name: &str,
        mcp_server: Option<&str>,
    ) -> Option<&SessionGrant> {
        self.grants.iter().rev().find(|g| {
            if g.session_id != session_id || g.domain != domain {
                return false;
            }
            if let Some(ref t) = g.tool_name {
                if t != tool_name {
                    return false;
                }
            }
            if let Some(ref s) = g.mcp_server {
                if Some(s.as_str()) != mcp_server {
                    return false;
                }
            }
            true
        })
    }

    pub fn list_for_session(&self, session_id: &str) -> Vec<SessionGrant> {
        self.grants
            .iter()
            .filter(|g| g.session_id == session_id)
            .cloned()
            .collect()
    }
}

// ── Audit ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub ts: u64,
    pub session_id: String,
    pub agent_id: Option<String>,
    pub domain: String,
    pub tool_name: String,
    pub input_summary: String,
    pub decision: AuditDecision,
    #[serde(default)]
    pub run_mode: RunMode,
    #[serde(default)]
    pub mode_name: String,
    #[serde(default)]
    pub grant_used: bool,
}

const AUDIT_CAP: usize = 500;

pub fn append_audit(app: &AppHandle, event: AuditEvent) {
    let mut list = persist::load_permission_audit(app);
    list.insert(0, event);
    if list.len() > AUDIT_CAP {
        list.truncate(AUDIT_CAP);
    }
    persist::save_permission_audit(app, &list);
}

pub fn list_audit(app: &AppHandle, limit: usize) -> Vec<AuditEvent> {
    let list = persist::load_permission_audit(app);
    list.into_iter().take(limit.max(1)).collect()
}

// ── Mapping / constraints ─────────────────────────────────────────────────────

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

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn make_audit(
    session_id: &str,
    agent_id: Option<&str>,
    domain: Domain,
    tool_name: &str,
    input_summary: &str,
    decision: AuditDecision,
    mode_name: &str,
    grant_used: bool,
) -> AuditEvent {
    AuditEvent {
        id: uuid::Uuid::new_v4().to_string(),
        ts: now_secs(),
        session_id: session_id.to_string(),
        agent_id: agent_id.map(str::to_string),
        domain: domain.as_str().to_string(),
        tool_name: tool_name.to_string(),
        input_summary: input_summary.to_string(),
        decision,
        run_mode: RunMode::Assist,
        mode_name: mode_name.to_string(),
        grant_used,
    }
}

/// UI 用：域列表说明
#[derive(Debug, Clone, Serialize)]
pub struct DomainInfo {
    pub id: String,
    pub label: String,
    pub policy: DomainPolicy,
}

// ── Mode CRUD ─────────────────────────────────────────────────────────────────

pub fn list_modes(cfg: &PermissionConfig) -> Vec<PermissionMode> {
    cfg.sorted_modes().into_iter().cloned().collect()
}

pub fn add_mode(
    cfg: &mut PermissionConfig,
    name: String,
    description: String,
    domains: Option<HashMap<String, DomainPolicy>>,
) -> Result<PermissionMode, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("模式名称不能为空".into());
    }
    let mut d = domains.unwrap_or_else(default_domains);
    ensure_mode_domains(&mut d);
    let sort_order = cfg.modes.iter().map(|m| m.sort_order).max().unwrap_or(-1) + 1;
    let mode = PermissionMode {
        id: format!("mode_{}", uuid::Uuid::new_v4().as_simple()),
        name,
        description: description.trim().to_string(),
        sort_order,
        domains: d,
    };
    cfg.modes.push(mode.clone());
    cfg.normalize_sort();
    Ok(mode)
}

pub fn update_mode(
    cfg: &mut PermissionConfig,
    id: &str,
    name: String,
    description: String,
    domains: HashMap<String, DomainPolicy>,
) -> Result<PermissionMode, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("模式名称不能为空".into());
    }
    let mode = cfg
        .modes
        .iter_mut()
        .find(|m| m.id == id)
        .ok_or_else(|| "模式不存在".to_string())?;
    let mut d = domains;
    ensure_mode_domains(&mut d);
    mode.name = name;
    mode.description = description.trim().to_string();
    mode.domains = d;
    Ok(mode.clone())
}

pub fn remove_mode(cfg: &mut PermissionConfig, id: &str) -> Result<(), String> {
    if cfg.modes.len() <= 1 {
        return Err("至少保留一个权限模式".into());
    }
    let before = cfg.modes.len();
    cfg.modes.retain(|m| m.id != id);
    if cfg.modes.len() == before {
        return Err("模式不存在".into());
    }
    cfg.normalize_sort();
    if cfg.active_mode_id == id {
        cfg.active_mode_id = cfg
            .sorted_mode_ids()
            .into_iter()
            .next()
            .unwrap_or_default();
    }
    Ok(())
}

pub fn reorder_modes(cfg: &mut PermissionConfig, ordered_ids: Vec<String>) -> Result<(), String> {
    if ordered_ids.len() != cfg.modes.len() {
        return Err("排序列表与模式数量不一致".into());
    }
    for id in &ordered_ids {
        if !cfg.modes.iter().any(|m| m.id == *id) {
            return Err(format!("未知模式 id: {id}"));
        }
    }
    for (order, id) in ordered_ids.iter().enumerate() {
        if let Some(m) = cfg.modes.iter_mut().find(|m| m.id == *id) {
            m.sort_order = order as i32;
        }
    }
    Ok(())
}

pub fn set_active_mode(cfg: &mut PermissionConfig, id: &str) -> Result<PermissionMode, String> {
    let mode = cfg
        .modes
        .iter()
        .find(|m| m.id == id)
        .cloned()
        .ok_or_else(|| "模式不存在".to_string())?;
    cfg.active_mode_id = id.to_string();
    Ok(mode)
}
