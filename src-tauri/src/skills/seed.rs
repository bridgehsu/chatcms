use tauri::AppHandle;

use super::types::{now_ms, Skill, SkillSource};

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
