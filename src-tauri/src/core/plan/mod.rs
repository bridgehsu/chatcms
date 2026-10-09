//! 规划编排层：system prompt 组装 + Agent Loop（模型规划 / 多轮）。

pub mod compress;
mod prompt;
mod agent_loop;
mod profile;
mod run;

pub use agent_loop::run_agent_loop;
pub use profile::resolve_profile;
pub use prompt::{build_api_messages, build_system_prompt};
pub use run::run;
