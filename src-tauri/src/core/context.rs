//! 一轮对话上下文（类似 Spring 的 Request + Model）。
//!
//! 应用级依赖通过 `app` 取 `AgentState`（类似 ApplicationContext）；
//! 本结构只承载本轮中间结果。
//!
//! 若需同时改 `ctx` 字段并持有 `State`，先 `let app = ctx.app.clone()`，
//! 再 `app.state()`，避免与 `ctx` 借用冲突。

use tauri::AppHandle;

use crate::chat::trace::ChatTrace;
use crate::core::decision::ChatMode;
use crate::core::intent::Intent;
use crate::core::tools::ToolDef;

pub struct TurnContext {
    /// Tauri 应用句柄；取 AgentState / 发事件 / 落库都走它
    pub app: AppHandle,

    // —— 入口入参（前端 / 渠道传入，整轮不变）——

    /// 用户本轮输入原文
    pub content: String,
    /// 入参：已有会话 id；`None` 表示新建会话
    pub session_id_in: Option<String>,
    /// 入参：新建会话时归属的分组 id
    pub group_id_in: Option<String>,
    /// 入参：运行模式原始字符串（如 ask / agent），解析前暂存
    pub mode_raw: Option<String>,
    /// 入参：用户显式指定的 Agent id（优先于意图选角；会话已绑定则沿用绑定）
    pub agent_id_in: Option<String>,

    // —— 决策中间结果 ——

    /// 解析后的运行模式（Ask / Agent 等）
    pub mode: ChatMode,
    /// 意图识别结果；intent 层写入
    pub intent: Option<Intent>,
    /// 决策层解析出的本轮 Agent id
    pub resolved_agent_id: Option<String>,
    /// 新建会话时需要绑定的 Agent id（可与 resolved 相同）
    pub bind_on_create: Option<String>,

    // —— 会话层产出 ——

    /// 本轮实际会话 id（ensure_session 后写入）
    pub sid: Option<String>,
    /// 会话绑定的工作区目录
    pub workspace_dir: Option<String>,
    /// 会话当前绑定的 Agent id（可能来自历史绑定或本轮决策）
    pub session_agent_id: Option<String>,

    // —— 规划 / 观测 ——

    /// 本轮可用工具列表（决策层按模式收集）
    pub tools: Vec<ToolDef>,
    /// 组装好的 system prompt；plan 层写入
    pub system_prompt: Option<String>,
    /// 本轮链路观测（分段耗时）；session 层启动，response 层落库
    pub trace: Option<ChatTrace>,
}

impl TurnContext {
    pub fn new(
        app: AppHandle,
        session_id: Option<String>,
        content: String,
        mode: Option<String>,
        group_id: Option<String>,
        agent_id: Option<String>,
    ) -> Self {
        Self {
            app,
            content,
            session_id_in: session_id,
            group_id_in: group_id,
            mode_raw: mode,
            agent_id_in: agent_id,
            mode: ChatMode::Ask,
            intent: None,
            resolved_agent_id: None,
            bind_on_create: None,
            sid: None,
            workspace_dir: None,
            session_agent_id: None,
            tools: Vec::new(),
            system_prompt: None,
            trace: None,
        }
    }
}
