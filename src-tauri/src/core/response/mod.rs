//! 响应生成层：助手终态写入与本轮链路落库。

mod finalize;
mod run;

pub use finalize::finalize_assistant_turn;
pub use run::run;
