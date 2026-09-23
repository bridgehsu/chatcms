//! Agent 运行分层（借鉴 Spring：编排器 + 请求上下文 + 分层 Handler）。
//!
//! - [`start_turn`]：总编排（Dispatcher）
//! - [`TurnContext`]：一轮上下文（Request/Model）
//! - [`pipeline`]：层间钩子（Interceptor：日志 / trace）
//! - 各层 `run(ctx)`：业务步骤
//!
//! ```text
//! session → intent → decision → plan ⇄ execute → response
//! ```
//!
//! 会话数据在 `crate::chat`；应用级状态在 `AgentState`（类似 ApplicationContext）。

pub mod session;
pub mod intent;
pub mod decision;
pub mod plan;
pub mod execute;
pub mod memory;
pub mod response;
pub mod tools;

mod context;
mod pipeline;
mod turn;

pub use context::TurnContext;
pub use turn::start_turn;
