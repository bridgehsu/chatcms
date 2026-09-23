//! 记忆 / 知识层：知识库注入、工具结果截断、会话快照协作。

pub mod truncate;
mod knowledge;
mod snapshot;

pub use knowledge::knowledge_block;
pub use snapshot::save_snapshot;
pub use truncate::truncate_tool_result;
