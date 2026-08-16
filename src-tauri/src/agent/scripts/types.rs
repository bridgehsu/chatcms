use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    Bundled,
    Workspace,
    Managed,
}

impl Default for SkillSource {
    fn default() -> Self {
        SkillSource::Workspace
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    /// 唯一 slug（小写字母、数字、连字符），对应 SKILL.md `name`
    pub name: String,
    /// 一行描述，展示给 Agent 与 UI
    pub description: String,
    /// SKILL.md 正文（指令）
    pub body: String,
    #[serde(default)]
    pub source: SkillSource,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 是否可作为用户斜杠指令（预留）
    #[serde(default = "default_true")]
    pub user_invocable: bool,
    /// true 时不进入模型 system prompt（仍可人工调用）
    #[serde(default)]
    pub disable_model_invocation: bool,
    #[serde(default)]
    pub homepage: Option<String>,
    /// OpenClaw `metadata.openclaw` JSON（gating 等）
    #[serde(default)]
    pub metadata: Option<Value>,
    pub created: i64,
    pub updated: i64,
}

pub fn default_true() -> bool {
    true
}

pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn validate_name(name: &str) -> Result<String, String> {
    let name = name.trim().to_lowercase();
    if name.is_empty() {
        return Err("技能名称不能为空".into());
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err("名称仅允许小写字母、数字与连字符".into());
    }
    if name.starts_with('-') || name.ends_with('-') || name.contains("--") {
        return Err("名称格式无效".into());
    }
    Ok(name)
}
