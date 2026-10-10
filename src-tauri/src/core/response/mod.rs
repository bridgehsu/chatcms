//! 收尾：助手正文 finalize（供 plan 调用）+ 本轮 trace 落库（turn 末尾）。
//!
//! 模块名历史原因叫 response；**不负责**拼 prompt / 调模型。

mod finalize;
mod run;

pub use finalize::finalize_assistant_turn;
pub use run::run;
