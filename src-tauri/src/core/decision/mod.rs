//! 决策 / 路由层：运行模式、角色挑选、本轮工具集合。
//!
//! 真正的工具权限裁决在 `crate::agents::dispatch`（执行前）。

pub mod mode;
mod agent;
mod run;

pub use mode::{pick_agent_for_intent, ChatMode};
pub use agent::{
    collect_tools, maybe_bind_session_agent, resolve_active_agent, resolve_turn_agent,
};
pub use run::run;
