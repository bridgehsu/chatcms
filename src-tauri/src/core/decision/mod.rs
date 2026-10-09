//! 决策 / 路由层：运行模式、角色挑选、本轮工具集合。
//!
//! 真正的工具权限裁决在 `crate::agents::dispatch`（执行前）。

pub mod mode;
mod agent;
mod run;

pub use agent::resolve_active_agent;
pub use mode::ChatMode;
pub use run::run;
