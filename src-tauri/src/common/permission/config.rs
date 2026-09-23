use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::types::{Domain, DomainPolicy, RunMode};

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

pub fn default_domains() -> HashMap<String, DomainPolicy> {
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

pub(super) fn ensure_mode_domains(domains: &mut HashMap<String, DomainPolicy>) {
    for d in Domain::all() {
        domains.entry(d.as_str().to_string()).or_insert_with(|| match d {
            Domain::FileRead => DomainPolicy::Allow,
            Domain::Network | Domain::Browser | Domain::App => DomainPolicy::Deny,
            _ => DomainPolicy::Ask,
        });
    }
}

pub fn default_shell_deny() -> Vec<String> {
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
