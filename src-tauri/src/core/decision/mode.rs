//! 会话运行模式：Ask / Agent / Search。
//!
//! - Mode 由用户显式选择（与模型选择器的 Auto 无关）
//! - Mode 决定本轮是否带 tools、system 怎么裁
//! - Agent 档案（角色）在 Agent 模式下由意图或用户显式指定

use crate::core::intent::{Intent, IntentKind};
use crate::agents::AgentProfile;

/// 用户选择的运行模式（仅三档）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChatMode {
    /// 纯问答：无 tools，短 system，保留会话历史
    Ask,
    /// 工具干活：全量或内置 tools + 角色上下文
    Agent,
    /// 知识库检索增强问答：无执行类 tools，多注入 knowledge
    Search,
}

impl ChatMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ask => "ask",
            Self::Agent => "agent",
            Self::Search => "search",
        }
    }

    /// 未知或空 → Ask（安全默认；模型 Auto 不在此枚举）
    pub fn parse(s: &str) -> Self {
        match s.trim().to_ascii_lowercase().as_str() {
            "agent" => Self::Agent,
            "search" => Self::Search,
            _ => Self::Ask,
        }
    }

    pub fn use_tools(self) -> bool {
        matches!(self, Self::Agent)
    }

    pub fn inject_skills(self) -> bool {
        matches!(self, Self::Agent)
    }

    pub fn inject_knowledge(self) -> bool {
        matches!(self, Self::Agent | Self::Search)
    }

    pub fn knowledge_limit(self) -> usize {
        match self {
            Self::Search => 8,
            Self::Agent => 3,
            Self::Ask => 0,
        }
    }

    pub fn inject_intent_block(self) -> bool {
        // Ask 省略意图块以缩短 prefill；Search/Agent 保留提示
        !matches!(self, Self::Ask)
    }
}

/// 按意图为 Agent 模式挑选角色（用户未指定时）。
///
/// 映射策略（可后续改为可配置 tag）：
/// - content_publish → slug `writer` 或技能含 content-publish
/// - account_lookup → slug 含 account / vault，否则默认
/// - use_tools / 其它 → 配置中的 active，否则第一个 enabled
pub fn pick_agent_for_intent(
    agents: &[AgentProfile],
    intent: &Intent,
    active_agent_id: Option<&str>,
) -> Option<AgentProfile> {
    let enabled: Vec<&AgentProfile> = agents.iter().filter(|a| a.enabled).collect();
    if enabled.is_empty() {
        return None;
    }

    let by_slug = |slug: &str| enabled.iter().find(|a| a.slug == slug).map(|a| (*a).clone());

    let by_skill = |name: &str| {
        enabled
            .iter()
            .find(|a| {
                a.skills
                    .as_ref()
                    .map(|s| s.iter().any(|x| x == name))
                    .unwrap_or(false)
            })
            .map(|a| (*a).clone())
    };

    let default_agent = || {
        active_agent_id
            .and_then(|id| enabled.iter().find(|a| a.id == id).map(|a| (*a).clone()))
            .or_else(|| enabled.first().map(|a| (*a).clone()))
    };

    // 低置信不瞎跳角色
    if intent.confidence < 0.5 && intent.kind != IntentKind::UseTools {
        return default_agent();
    }

    match intent.kind {
        IntentKind::ContentPublish => by_slug("writer")
            .or_else(|| by_skill("content-publish"))
            .or_else(default_agent),
        IntentKind::AccountLookup => enabled
            .iter()
            .find(|a| {
                a.slug.contains("account")
                    || a.slug.contains("vault")
                    || a.name.contains("账号")
            })
            .map(|a| (*a).clone())
            .or_else(default_agent),
        IntentKind::UseTools => default_agent(),
        IntentKind::GeneralChat | IntentKind::Unknown => default_agent(),
    }
}
