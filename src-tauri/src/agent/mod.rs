//! Agent 运行时：全局状态、工具分发、子 Agent。

pub mod state;
pub mod dispatch;
pub mod subagent;

pub use state::{AgentState, PermissionUserReply};
