# 项目概览

ChatCMS 是基于 **Tauri v2 + React** 的桌面 Agent 应用，把智能会话、多角色代理、内容笔记、图片/视频工厂、媒体采集与发布放在同一套本地工作台里。

## 你能做什么

| 区域 | 能力 |
|------|------|
| 工作台 | 智能会话、业务地图、内容管理、图片/视频工厂、调度中心 |
| 媒体管理 | 采集任务、插件脚本、账号保险柜 |
| 智能配置 | 代理档案、技能、MCP、模型、意图规则、知识库 |
| 系统设置 | 权限、渠道、运行观测 |

## 三种会话模式

- **Ask**：纯问答，不调用工具
- **Agent**：带内置工具与 MCP，可注入技能与知识
- **Search**：侧重知识库检索增强回答

模式在输入区切换；**主 Agent** 在顶栏选择（可自动选角或固定某一角色）。

## 技术栈

- 前端：React 19 · Vite · Zustand · CabinX
- 后端：Rust · Tauri v2 · SQLite
- 运行分层：`session → intent → decision → plan ⇄ execute → response`

更细的循环说明见 [Agent Loop](/concepts/agent-loop)。

## 相关仓库

- 本仓库：桌面端与文档站
- 采集 Worker：可选连接 `chatcms-collect`（默认 `http://127.0.0.1:8080`）
