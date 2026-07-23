//! Agent 运行时：会话状态、主循环、工具分发、子 Agent、权限审批。

mod chat;
mod dispatch;
mod permission;
mod state;
mod subagent;
mod turns;

pub use chat::send_message;
pub use permission::resolve_permission;
pub use state::AgentState;
pub use subagent::run_sub_agent;
