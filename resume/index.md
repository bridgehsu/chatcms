# ChatCMS 项目经历（简历用）

### ChatCMS — 自媒体桌面 AI Agent 工作台
**角色**：独立负责人（产品设计 + 架构 + 前后端实现）   
**技术栈**：Rust / Tokio / Tauri v2 · React 19 / Vite / TypeScript / Zustand / Ant Design · SQLite (sqlx) · SSE · MCP · Argon2id + AES-256-GCM  

#### 项目描述

ChatCMS 是一款面向新媒体运营场景的跨平台桌面 AI Agent 工作台，支持 macOS / Windows。围绕内容生产与运营流程，构建多模型流式对话、Tool Use、MCP 扩展、权限沙箱及多 Agent 协作能力；打通选题笔记、图文/视频生产、账号管理、媒体数据采集、任务调度与浏览器插件等模块，形成“内容策划 → 内容生产 → 竞品采集 → 定时执行 → 发布管理”的运营闭环。数据默认本地存储，支持云端模型与本地推理接入。

#### 技术描述

1.**整体架构：**以 Tauri 跨平台桌面端为核心，协同接入媒体采集 Worker、视频生成服务与浏览器插件；桌面端承担统一编排、身份鉴权、本地数据管理与任务入口，周边服务及扩展按职责独立运行。  
2.**桌面全栈：**前端采用 React 19、Zustand 与 Ant Design；原生侧采用 Rust、Tokio 与 Tauri v2，按 commands → service → repository 分层。业务数据本地存储于 SQLite（sqlx）及 JSON Store。  
3.**采集服务：**独立维护 chatcms-collect Worker，基于 Playwright 浏览器自动化接入多平台内容采集；通过 FastAPI 提供启停、状态查询、日志查看及数据文件管理等 HTTP 控制接口。  
4.**桌面集成：**ChatCMS 通过 reqwest 调用本地 Worker，管理采集任务配置、参数下发、任务 CRUD 与日志轮询，并将采集结果纳入本地内容库。  
5.**视频生成服务：**对接 MoneyPrinterTurbo / chatcms-video 本地服务，提供脚本生成、素材与 BGM 上传、视频任务创建及任务状态查询能力。  
6.**本地视频资产管理：**桌面端通过 HTTP / multipart 转发视频生成请求，将生成结果回写至本机视频库，与图文素材、选题和内容草稿统一管理。  
7.**本机发布桥：**桌面端内嵌 Axum HTTP 服务，向浏览器插件提供草稿、媒体资源、平台配置及脚本获取接口。  
8.**插件脚本管理：**桌面端维护多平台发布与采集脚本，支持草稿、版本发布与扩展侧消费；浏览器插件负责页面交互与发布流程辅助，并复用会话桥实现页内智能对话。  
9.**Agent Loop：**实现“用户消息 → Prompt 组装 → SSE 流式生成 → Tool Call → 结果回灌 → 多轮执行 / 中止”的完整循环；自研 Anthropic 与 OpenAI-compatible Provider，基于 reqwest SSE 接入。  
10.**工具与 MCP 扩展：**内置 Shell、文件、web_fetch、spawn_agent 等工具；通过 stdio JSON-RPC 动态接入 MCP Server，并在执行前统一进行权限裁决。  
11.**多 Agent 与上下文管理：**支持 Agent 档案、技能白名单及 Workspace 锁定；通过 SKILL.md 与知识库内容注入 Prompt，并以规则打分实现软意图路由。  
12.**权限与沙箱：**实现 allow / ask / deny 域策略、会话级临时授权与审计日志；文件工具基于 Workspace 路径沙箱控制访问范围。  
13.**账号与敏感数据保护：**主密码通过 Argon2id 派生密钥，敏感字段采用 AES-256-GCM 本地加密，并支持限时解锁与自动锁定。  
14.**任务中枢：**基于节点化工作流编排模型配置运营自动化任务，将采集、内容生成、审核、定时执行与发布能力统一纳入任务中枢，支持任务状态追踪、失败重试与执行日志查看。

#### 工作职责

- 独立完成产品设计与全栈实现，搭建 Tauri 桌面主程序，并接入采集 Worker、视频生成服务与浏览器插件
- 自研 Agent 运行时：多模型 SSE 流式对话、Tool Calling 多轮循环、MCP 扩展与工具权限裁决
- 实现多 Agent / 技能 / 知识库注入，以及可配置的意图软路由（引导行为，不短路主循环）
- 落地工作区文件沙箱、审计日志，以及账号敏感字段本地加密（主密码解锁）
- 打通新媒体业务：选题笔记、图文与视频生产、媒体采集任务、调度中心、插件脚本发布
- 统一前后端分层与本地数据持久化，完成 macOS / Windows 打包发布

#### 技术亮点

1. **自研 Agent Runtime，而非 LangChain 套壳** —— 对 SSE、Tool 协议、中止、多轮回灌有完整控制权
2. **安全默认本地化** —— workspace 沙箱 + 权限裁决 + 加密保险柜，适合桌面敏感场景
3. **可扩展工具生态** —— 内置工具与 MCP 统一 dispatch，外部能力可插拔
4. **软意图 + 硬工具** —— 规则层可运营配置，决策仍交给 LLM Tool Use，避免过早做成僵硬意图中台
5. **自媒体全链路闭环** —— 从 Agent/技能配置到选题、生产、采集、发布同屏完成

#### Skills / 关键词

`Rust` · `Tokio` · `Tauri` · `React` · `TypeScript` · `LLM Agent` · `Tool Use / Function Calling` · `SSE Streaming` · `MCP` · `Prompt Engineering` · `SQLite` · `权限与沙箱` · `Multi-Agent` · `AES-GCM` · `Zustand`

---

## 二、一页纸精简版（约 8～10 条）

独立负责 ChatCMS 桌面 AI Agent 平台（Rust + Tauri + React）：

1. 自研 Tool-using Agent Loop 与 Anthropic/OpenAI-compatible SSE Provider，支持多模型路由、思考模式与流式中止
2. 落地内置工具 + MCP stdio 扩展，工具调度前统一权限裁决（allow/ask/deny）与会话授权
3. 实现 workspace 文件沙箱、审计日志，以及 Argon2id + AES-GCM 本地账号保险柜
4. 支持多 Agent 档案、技能白名单与 spawn_agent 子 Agent 协作循环
5. 设计可配置意图软路由（关键词规则打分注入 prompt，不短路主循环）
6. 完成 SKILL.md 技能注入、知识库检索进 prompt、上下文截断策略
7. 打通 Telegram 渠道复用同一会话入口；覆盖笔记/生图生视频/采集/调度/发布等业务页
8. 建立前后端分层与双端打包（macOS / Windows），数据以 SQLite 与本地存储为主

---

## 三、面试主链路（建议背熟）

> 更完整的主流程拆解见同目录 `[chatcms-main-flows.md](./chatcms-main-flows.md)`。

```text
ChatWindow
  → invoke chat_send
  → ensure_session（锁定 workspace）
  → intent::run（软路由）
  → build_system_prompt（persona + intent + knowledge + skills）
  → run_agent_loop
       → provider::stream_chat（SSE）
       → tool call → dispatch
            → authorize（权限）
            → builtin / MCP / spawn_agent
            → check_workspace（沙箱）
       → 回灌 tool result → 继续循环
  → emit stream-chunk / tool-* / permission-request
```

高频追问准备：


| 问题               | 答法要点                                    |
| ---------------- | --------------------------------------- |
| 为什么不用 LangChain？ | 桌面端要控 SSE/中止/权限/沙箱，自研链路更短、可控            |
| 意图会不会抢决策？        | 不会；只注入 `<user_intent>`，真正行动靠 Tool Use   |
| 如何防读盘越权？         | 会话锁定 workspace + 路径 canonicalize + 前缀校验 |
| MCP 怎么接？         | stdio 子进程 JSON-RPC，tools 统一进 dispatch   |
| 多模型怎么选？          | Profile 权重/分层/标签 + 失败冷却；会话可钉选           |


---

## 四、按岗位微调建议


| 目标岗位           | 强调                                        | 弱化            |
| -------------- | ----------------------------------------- | ------------- |
| Agent / LLM 工程 | Runtime、Tool Use、MCP、Prompt、意图软路由、多 Agent | 业务页数量         |
| 全栈 / 桌面客户端     | Tauri、React、分层、打包、保险柜、业务闭环                | Provider 协议细节 |
| 安全 / 基础设施工     | 权限引擎、沙箱、加密、审计                             | 内容运营功能        |


---

## 五、表述避坑

- 写「自研 Agent Loop / Provider」，少写「调用了 ChatGPT」
- 意图写「软路由 / 可配置规则」，不要写成完整 NLU / 意图中台
- 无真实数据时不要编造 QPS、用户量；有再补
- 关联仓库（chatcms-collect / extension）可作「周边协作」，主项目仍写 ChatCMS

---

## 六、产品能力速查（方便口述）


| 域     | 能力                                    |
| ----- | ------------------------------------- |
| 智能会话  | 流式对话、工具、权限弹窗、模型选择、会话/workspace        |
| 智能配置  | 代理、技能、MCP、模型 Profile、意图规则             |
| 系统设置  | 权限管理、渠道列表（Telegram）                   |
| 内容与媒体 | 笔记知识库、图片/视频、插件脚本、媒体采集（采集任务 / 账号）、调度中心 |
| 账号与调度 | 本地密码本保险柜、n8n 风格工作流画布                  |
| 其它    | 业务地图、浏览器发布桥、双端打包                      |


版本参考：应用版本 `0.0.4`（以仓库 `package.json` / `Cargo.toml` 为准）。