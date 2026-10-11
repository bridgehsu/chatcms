//! Agent 运行分层（借鉴 Spring：编排器 + 请求上下文 + 分层 Handler）。
//!
//! - [`run`]：总编排（Dispatcher）
//! - [`TurnContext`]：一轮上下文（Request/Model）
//! - [`pipeline`]：层间钩子（Interceptor：日志 / trace）
//! - 各层 `run(ctx)`：业务步骤
//!
//! ```text
//! session → intent → decision → plan[ script_turn | task_turn → loop ⇄ execute ] → response(trace)
//! ```
//!
//! - **session**：建/复用会话、写用户消息、解析 mode、开 trace  
//! - **intent**：软路由 Intent（不短路）  
//! - **decision**：角色绑定 + 本轮 tools（沿用 session 已解析的 mode）  
//! - **plan**：拼 prompt；`script_turn` / `task_turn`（@脚本 / @任务串联）；Agent Loop；嵌套 **execute**  
//! - **response**：本轮链路落库（不是生成助手正文）
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

pub use turn::run;
