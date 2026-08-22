//! 意图识别最终产物类型（对外主类型仍叫 `Intent`）。

use serde::{Deserialize, Serialize};

/// 当前支持的意图类别（可随产品扩展）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentKind {
    /// 闲聊 / 一般问答
    GeneralChat,
    /// 需要读写文件、bash、MCP 等工具
    UseTools,
    /// 内容发布 / 多平台同步
    ContentPublish,
    /// 账号 / 密码本相关
    AccountLookup,
    /// 未识别或低置信
    Unknown,
}

impl IntentKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::GeneralChat => "general_chat",
            Self::UseTools => "use_tools",
            Self::ContentPublish => "content_publish",
            Self::AccountLookup => "account_lookup",
            Self::Unknown => "unknown",
        }
    }

    pub fn label_zh(self) -> &'static str {
        match self {
            Self::GeneralChat => "闲聊问答",
            Self::UseTools => "工具执行",
            Self::ContentPublish => "内容发布",
            Self::AccountLookup => "账号查询",
            Self::Unknown => "未识别",
        }
    }
}

/// 分类结果来源（可观测）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum IntentSource {
    #[default]
    Rules,
    LocalLlm,
    Fused,
}

impl IntentSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Rules => "rules",
            Self::LocalLlm => "local_llm",
            Self::Fused => "fused",
        }
    }
}

/// 单次分类最终结果（流水线出口）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Intent {
    pub kind: IntentKind,
    /// 0.0 ~ 1.0
    pub confidence: f32,
    /// 命中的关键词（调试 / 可观测）
    #[serde(default)]
    pub matched: Vec<String>,
    #[serde(default)]
    pub source: IntentSource,
    /// 是否偏向需要工具（由 enrich 写入）
    #[serde(default)]
    pub needs_tools: bool,
}

impl Intent {
    pub fn unknown() -> Self {
        Self {
            kind: IntentKind::Unknown,
            confidence: 0.0,
            matched: vec![],
            source: IntentSource::Rules,
            needs_tools: false,
        }
    }

    /// 是否偏向需要工具（供模型路由或后续裁剪 tools 使用）。
    pub fn prefers_tools(&self) -> bool {
        self.needs_tools
    }
}
