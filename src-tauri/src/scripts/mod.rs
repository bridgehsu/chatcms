//! OpenClaw 风格 Skills：每个技能对应一份 SKILL.md（frontmatter + markdown 正文）。
//! 启用的技能会进入 Agent 的 system prompt（目录 + 相关正文）。

pub mod commands;
pub mod repository;

mod types;
mod seed;
mod service;
mod prompt;

pub use types::{Skill, SkillSource};
pub use seed::ensure_seeded;
pub use service::{list, add, update, remove, install_npx};
pub use prompt::{format_for_prompt, to_skill_md};
