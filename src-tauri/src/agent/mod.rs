//! Agent 运行时：会话状态、主循环、工具分发、子 Agent、权限审批。

pub mod core;
pub mod mcp;
pub mod memory;
pub mod permission;
pub mod provider;
pub mod scripts;
pub mod tools;

pub use core::agents;
pub use core::commands;
pub use core::send_message;
pub use core::resolve_permission;
pub use core::AgentState;
pub use core::state;
