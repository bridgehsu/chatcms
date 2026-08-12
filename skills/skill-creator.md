---
name: skill-creator
description: "创建或改写符合 ChatCMS / OpenClaw 规范的 SKILL.md"
emoji: 🛠️
homepage: https://docs.openclaw.ai/tools/creating-skills
user-invocable: true
---

# 技能创作

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
