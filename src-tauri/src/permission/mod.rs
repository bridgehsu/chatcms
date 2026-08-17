//! 权限内核：自定义模式域策略 → 会话例外 → 审计。

pub mod commands;

mod audit;
mod authz;
mod config;
mod grants;
mod request;
mod types;

pub use audit::*;
pub use authz::*;
pub use config::*;
pub use grants::*;
pub use request::{request_permission, resolve_permission};
pub use types::*;
