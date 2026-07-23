//! OpenClaw 风格 Skills：每个技能对应一份 SKILL.md（frontmatter + markdown 正文）。
//! 启用的技能会进入 Agent 的 system prompt（目录 + 相关正文）。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use uuid::Uuid;

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
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_true() -> bool {
    true
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn validate_name(name: &str) -> Result<String, String> {
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

pub fn bundled_skills() -> Vec<Skill> {
    let ts = now_ms();
    vec![
        Skill {
            id: "bundled-content-publish".into(),
            name: "content-publish".into(),
            description: "撰写并适配多平台内容（小红书/抖音/公众号等）的发布文案与结构。".into(),
            body: r#"# 内容发布

当用户需要为社交/内容平台写文案或规划发布时使用本技能。

## 步骤

1. 确认平台、受众、语气与字数限制。
2. 先给 1 个主标题 + 3 个备选。
3. 正文用短段；需要话题标签时放在文末。
4. 若涉及账号管理中的平台密钥，只说明要用哪类凭证，不要编造真实 Token。
5. 输出「可直接复制」的成稿，并附一行发布检查清单。

## 禁忌

- 不编造数据或虚假背书。
- 不绕过平台内容安全规则。
"#
            .into(),
            source: SkillSource::Bundled,
            enabled: true,
            user_invocable: true,
            disable_model_invocation: false,
            homepage: None,
            metadata: Some(serde_json::json!({
                "openclaw": { "emoji": "📣" }
            })),
            created_at: ts,
            updated_at: ts,
        },
        Skill {
            id: "bundled-image-brief".into(),
            name: "image-brief".into(),
            description: "把创意需求整理成可直接用于 AI 生图的英文/中文提示词。".into(),
            body: r#"# 生图简报

用户要做封面、配图或视频关键镜时使用。

## 步骤

1. 提炼主体、风格、构图、光线、色彩、镜头。
2. 输出一条主提示词 + 两条变体。
3. 给出建议尺寸（如 1024x1024 / 16:9）。
4. 提醒可在「图片管理」中直接生成并保存。

## 格式

```
主体: …
风格: …
构图: …
负面提示: …
```
"#
            .into(),
            source: SkillSource::Bundled,
            enabled: true,
            user_invocable: true,
            disable_model_invocation: false,
            homepage: None,
            metadata: Some(serde_json::json!({
                "openclaw": { "emoji": "🎨" }
            })),
            created_at: ts,
            updated_at: ts,
        },
        Skill {
            id: "bundled-skill-creator".into(),
            name: "skill-creator".into(),
            description: "创建或改写符合 OpenClaw / AgentSkills 规范的 SKILL.md。".into(),
            body: r#"# 技能创作

帮助用户编写 ChatCMS / OpenClaw 兼容技能。

## SKILL.md 结构

```yaml
---
name: my-skill
description: "一句话说明何时使用。"
---

# 标题
步骤与禁忌…
```

## 原则

- `name` 用小写 slug；`description` 写触发条件，不要空泛。
- 正文保持精简；长文档放到 references（本应用可先写在正文分段）。
- 不要重复模型已会的通用常识；保留脆弱命令、鉴权与安全规则。
- 改完后提醒用户在「技能管理」中启用并保存。
"#
            .into(),
            source: SkillSource::Bundled,
            enabled: true,
            user_invocable: true,
            disable_model_invocation: false,
            homepage: Some("https://docs.openclaw.ai/tools/creating-skills".into()),
            metadata: Some(serde_json::json!({
                "openclaw": { "emoji": "🛠️" }
            })),
            created_at: ts,
            updated_at: ts,
        },
    ]
}

/// 首次为空时写入内置技能；已有数据则补齐缺失的 bundled（不覆盖用户改动的同名 workspace）。
pub fn ensure_seeded(app: &AppHandle) -> Vec<Skill> {
    let mut list = crate::persist::load_skills(app);
    if list.is_empty() {
        list = bundled_skills();
        crate::persist::save_skills(app, &list);
        return list;
    }

    let existing_names: std::collections::HashSet<_> =
        list.iter().map(|s| s.name.clone()).collect();
    let mut changed = false;
    for b in bundled_skills() {
        if !existing_names.contains(&b.name) {
            list.push(b);
            changed = true;
        }
    }
    if changed {
        crate::persist::save_skills(app, &list);
    }
    list
}

pub fn list(app: &AppHandle) -> Vec<Skill> {
    let mut list = ensure_seeded(app);
    list.sort_by(|a, b| {
        b.enabled
            .cmp(&a.enabled)
            .then(b.updated_at.cmp(&a.updated_at))
            .then(a.name.cmp(&b.name))
    });
    list
}

pub fn add(
    app: &AppHandle,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<Value>,
) -> Result<Skill, String> {
    let name = validate_name(&name)?;
    let description = description.trim().to_string();
    if description.is_empty() {
        return Err("描述不能为空".into());
    }

    let mut list = ensure_seeded(app);
    if list.iter().any(|s| s.name == name) {
        return Err(format!("已存在同名技能「{name}」"));
    }

    let ts = now_ms();
    let skill = Skill {
        id: Uuid::new_v4().to_string(),
        name,
        description,
        body,
        source: SkillSource::Workspace,
        enabled,
        user_invocable,
        disable_model_invocation,
        homepage: homepage.filter(|s| !s.trim().is_empty()),
        metadata,
        created_at: ts,
        updated_at: ts,
    };
    list.push(skill.clone());
    crate::persist::save_skills(app, &list);
    Ok(skill)
}

pub fn update(
    app: &AppHandle,
    id: String,
    name: String,
    description: String,
    body: String,
    enabled: bool,
    user_invocable: bool,
    disable_model_invocation: bool,
    homepage: Option<String>,
    metadata: Option<Value>,
) -> Result<Skill, String> {
    let name = validate_name(&name)?;
    let description = description.trim().to_string();
    if description.is_empty() {
        return Err("描述不能为空".into());
    }

    let mut list = ensure_seeded(app);
    if list.iter().any(|s| s.name == name && s.id != id) {
        return Err(format!("已存在同名技能「{name}」"));
    }

    let skill = list
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "技能不存在".to_string())?;

    // 内置技能允许编辑内容，但 source 保持 bundled
    skill.name = name;
    skill.description = description;
    skill.body = body;
    skill.enabled = enabled;
    skill.user_invocable = user_invocable;
    skill.disable_model_invocation = disable_model_invocation;
    skill.homepage = homepage.filter(|s| !s.trim().is_empty());
    if metadata.is_some() {
        skill.metadata = metadata;
    }
    skill.updated_at = now_ms();
    let out = skill.clone();
    crate::persist::save_skills(app, &list);
    Ok(out)
}

pub fn remove(app: &AppHandle, id: String) -> Result<(), String> {
    let mut list = ensure_seeded(app);
    let Some(skill) = list.iter().find(|s| s.id == id) else {
        return Err("技能不存在".into());
    };
    if skill.source == SkillSource::Bundled {
        return Err("内置技能不能删除，可停用".into());
    }
    list.retain(|s| s.id != id);
    crate::persist::save_skills(app, &list);
    Ok(())
}

/// 导出为 OpenClaw SKILL.md 文本（预览 / 复制）。
pub fn to_skill_md(skill: &Skill) -> String {
    let mut fm = format!(
        "---\nname: {}\ndescription: \"{}\"\n",
        skill.name,
        skill.description.replace('"', "\\\"")
    );
    if !skill.user_invocable {
        fm.push_str("user-invocable: false\n");
    }
    if skill.disable_model_invocation {
        fm.push_str("disable-model-invocation: true\n");
    }
    if let Some(url) = &skill.homepage {
        fm.push_str(&format!("homepage: {url}\n"));
    }
    if let Some(meta) = &skill.metadata {
        if let Ok(s) = serde_json::to_string(meta) {
            fm.push_str(&format!("metadata: {s}\n"));
        }
    }
    fm.push_str("---\n\n");
    fm.push_str(skill.body.trim());
    fm.push('\n');
    fm
}

fn tokenize(text: &str) -> std::collections::HashSet<String> {
    let lower = text.to_lowercase();
    let mut tokens: std::collections::HashSet<String> = lower
        .split(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
        .filter(|s| s.len() >= 2)
        .map(|s| s.to_string())
        .collect();
    for c in text.chars() {
        if ('\u{4e00}'..='\u{9fff}').contains(&c) || ('\u{3400}'..='\u{4dbf}').contains(&c) {
            tokens.insert(c.to_string());
        }
    }
    tokens
}

fn score_skill(skill: &Skill, tokens: &std::collections::HashSet<String>) -> f32 {
    let meta = format!("{} {}", skill.name, skill.description).to_lowercase();
    let body = skill.body.to_lowercase();
    let mut s = 0.0f32;
    for t in tokens {
        if meta.contains(t.as_str()) {
            s += 2.0;
        } else if body.contains(t.as_str()) {
            s += 1.0;
        }
    }
    s
}

/// 拼进 system prompt：始终给技能目录；相关技能附带正文（OpenClaw 风格）。
/// `allowlist`: None = 全部启用技能；Some([]) = 无；Some(names) = 白名单。
pub fn format_for_prompt(
    skills: &[Skill],
    query: &str,
    allowlist: Option<&[String]>,
) -> String {
    let eligible: Vec<&Skill> = skills
        .iter()
        .filter(|s| s.enabled && !s.disable_model_invocation)
        .filter(|s| match allowlist {
            None => true,
            Some(list) if list.is_empty() => false,
            Some(list) => list.iter().any(|n| n == &s.name),
        })
        .collect();
    if eligible.is_empty() {
        return String::new();
    }

    let mut parts = vec!["<skills>".to_string()];
    parts.push(
        "The following skills teach you specialized workflows. Prefer them when the user request matches a skill description."
            .into(),
    );
    parts.push("## Skill catalog".into());
    for s in &eligible {
        parts.push(format!("- **{}**: {}", s.name, s.description));
    }

    let tokens = tokenize(query);
    if !tokens.is_empty() {
        let mut scored: Vec<(f32, &Skill)> = eligible
            .iter()
            .filter_map(|s| {
                let sc = score_skill(s, &tokens);
                if sc > 0.0 {
                    Some((sc, *s))
                } else {
                    None
                }
            })
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let matched: Vec<&Skill> = scored.into_iter().take(2).map(|(_, s)| s).collect();
        if !matched.is_empty() {
            parts.push("## Active skill instructions".into());
            for s in matched {
                parts.push(format!(
                    "### {}\n{}\n\n{}",
                    s.name,
                    s.description,
                    s.body.trim()
                ));
            }
        }
    }

    parts.push("</skills>".into());
    parts.join("\n\n")
}
