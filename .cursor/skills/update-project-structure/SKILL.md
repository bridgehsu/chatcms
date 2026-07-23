---
name: update-project-structure
description: >-
  Keeps ChatCMS project-structure Cursor rule in sync with the real repo tree.
  Use after adding/moving/deleting modules or changing directory responsibilities,
  or when the user asks to refresh engineering structure docs / .cursor rules.
---

# Update Project Structure Rule

## Goal

`.cursor/rules/project-structure.mdc` must match the **current** ChatCMS layout.
Any structural code change in the same task must update that rule before finishing.

## When to run (mandatory)

Update the rule if **any** of these happened in this task:

- Added / removed / renamed files under `src/` or `src-tauri/src/`
- Split or merged a module (e.g. agent submodules)
- Moved a responsibility between crates/modules (even if filenames stay)
- Added a new top-level dir that agents should know about (`doc/`, scripts, etc.)

**Do not** update for pure logic refactors with no path/responsibility change.

## Procedure

1. Scan the live tree (ignore `node_modules`, `src-tauri/target`, `dist`, `.git`):

```bash
find src src-tauri/src doc .cursor -type f 2>/dev/null | sort
```

2. Open `.cursor/rules/project-structure.mdc`.
3. Rewrite the affected tree blocks so they match step 1.
4. Keep frontmatter:

```yaml
---
description: ChatCMS 工程目录与模块职责；改结构时必须同步更新本文件
alwaysApply: true
---
```

5. Keep sections: 维护约定 · 顶层 · 前端 · 后端 · 关键数据流 · 改结构时怎么动本文件.
6. One-line duties next to important files; do not paste large code.
7. If `doc/how-it-works.md` names modules that no longer exist, fix those names too (light touch).

## Done checklist

- [ ] Tree in the rule matches `find` output for `src/` and `src-tauri/src/`
- [ ] Public entrypoints still accurate (`lib.rs` commands, `agent/mod.rs` re-exports)
- [ ] No stale paths (deleted files not listed)
- [ ] Rule still concise (prefer under ~120 lines)

## Anti-patterns

```text
❌ 改完目录却只在聊天里口头说明、不改 project-structure.mdc
❌ 把整份 prompt.md / 源码粘进 rule
❌ 为无关的单行 bugfix 去重写整棵树
✅ 结构变更 → 同一 PR/同一回复里更新 rule
```
