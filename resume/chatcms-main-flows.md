# ChatCMS 主流程全览

> 从代码梳理的运行时 / 产品主链路，便于简历口述与面试画图。  
> 路径以仓库根为基准；后端 Agent 运行时在 `src-tauri/src/agents/`（非旧文档中的 `agent/core/`）。

---

## 总览图

```text
┌─────────────┐   chat_send / Telegram / Extension
│  触发入口    │──────────────────────────────────────┐
└─────────────┘                                      │
                                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ ensure_session（锁定 workspace）→ push_user_message               │
│ intent::run（软路由）→ build_system_prompt                        │
│   persona + <user_intent> + knowledge + skills                    │
└──────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ run_agent_loop                                                    │
│   选模型 Profile → provider::stream_chat（SSE）                    │
│   无 tool → 落库助手消息 → 结束                                    │
│   有 tool → authorize → spawn_agent | MCP | 内置工具               │
│            → tool_result 回灌 → 继续循环                           │
└──────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Tauri Events → Zustand UI                                         │
│ stream-chunk / thinking-chunk / tool-* / permission-request / …   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. 应用启动（Bootstrap）

**触发**：Tauri `run()` → `.setup(setup)`（`src-tauri/src/lib.rs`）

| 步骤 | 动作 | 副作用 |
|------|------|--------|
| 1 | 注册 State：`AgentState` / `PublishBridge` / `VaultState` | 内存 |
| 2 | 启动本机发布桥 `127.0.0.1:17890` | HTTP (axum) |
| 3 | `db::init` 加载 `scripts/database/schema.sql` | SQLite `chatcms.db` |
| 4 | 加载 AppConfig | store JSON |
| 5 | 加载 sessions / knowledge | 内存 + 已有 SQLite |
| 6 | `scripts::ensure_seeded` 技能 | 内置 SKILL.md + DB |
| 7 | `agents::ensure_seeded` | 代理档案 + workspace 目录 |
| 8 | `intent::ensure_seeded` | 意图规则 + 内存缓存 |
| 9 | 迁移旧 model profiles → SQLite | `model_profile` 表 |
| 10 | MCP `connect_all`（后台） | stdio 子进程 |
| 11 | 加载渠道配置（**不**自动开 Telegram 轮询） | store |
| 12 | 注册全部 Tauri commands | IPC |

---

## 2. 发消息 / Agent Loop（核心）

**触发**：

- 前端：`ChatWindow` → `useChatStore.sendMessage` → `invoke("chat_send")`
- 复用同一入口：Telegram、浏览器扩展 `POST /chat/send`

### 调用链

```text
src/views/chat/components/ChatWindow.tsx
  → src/stores/useChatStore.ts  invoke("chat_send")
  → chat/commands.rs::chat_send
  → chat/service.rs::send_message
       → ensure_session
       → push_user_message + save_snapshot
       → resolve_active_agent
       → intent::run(&content)
       → build_system_prompt(...)
       → 注册 abort_handles（watch）
       → run_agent_loop(...)
```

### Agent Loop 每轮

```text
检查 abort
  → 列出 model_profile，按优先级选模型（见 §6）
  → 组装 API messages（可截断）
  → tools = 内置工具 + MCP 工具
  → provider::stream_chat（anthropic | openai）
       emit: stream-chunk / thinking-chunk
  → 无 tool_calls → 保存助手消息 / 自动标题 → 结束
  → 有 tool_calls → execute_one_tool → dispatch_tool（见 §3）
       → tool 结果写入会话 → 下一轮
  → emit: session-token-usage
```

**中止**：`chat_abort` → `abort_handles[session].send(true)` → 循环退出。

**关键文件**：

- `src-tauri/src/chat/service.rs`
- `src-tauri/src/provider/{mod,anthropic,openai}.rs`
- `src/stores/useChatStore.ts`

---

## 3. 工具调度 + 权限

**触发**：Agent Loop 或子 Agent 产生 `tool_calls`

```text
execute_one_tool
  → emit tool-call
  → agents/dispatch.rs::dispatch_tool
       → permission::authorize
            顺序：session_grants → 黑/白名单 → 模式域策略
                 → agent.perms / MCP 覆盖
            结果：Allow | Deny | Ask
       → Ask：permission/request.rs
            emit permission-request → 前端弹窗
            invoke permission_respond → oneshot 完成（超时≈拒绝）
       → Allow 后分流：
            spawn_agent     → §5
            mcp__*__*       → §4
            内置工具        → agents/tools::execute
                 bash / read_file / write_file / web_fetch /
                 search_files / glob_files
                 └─ check_workspace(session.workspace_dir, path)
  → emit tool-result
  → 截断结果、Role::Tool 入会话、save_snapshot
```

**权限域**：`FileRead` / `FileWrite` / `Shell` / `Agent` / `Network` / `Mcp`

**子 Agent 工具**：走同一鉴权，但 **Ask 直接拒绝**（无 UI）。

**审计**：裁决写入审计日志（SQLite）。

---

## 4. MCP 连接与调用

**连接触发**：启动 `connect_all`；或 MCP 管理页 `mcp_add` / `reconnect` 等。

```text
mcp/repository 读配置
  → McpManager::connect_one
  → McpClient::connect（stdio 子进程）
  → JSON-RPC initialize + tools/list
  → 暴露为 mcp__{server}__{tool}
```

**调用**：

```text
dispatch_tool → is_mcp_tool
  → timeout(60s, mcp.call_tool(api_name, input))
  → McpClient::call_tool
```

**关键文件**：`src-tauri/src/mcp/{manager,client,commands,service}.rs`  
**前端**：`src/views/mcp/index.tsx`

---

## 5. spawn_agent / 子 Agent

**触发**：模型调用工具 `spawn_agent`

```text
dispatch_spawn_agent
  → 按 slug/id 找 Agent（enabled && spawnable）
  → 组装子 prompt（persona + skills）
  → emit subagent-start
  → agents/subagent.rs::run_sub_agent
       workspace = clamp(parent, child)
       循环 ≤ 30 次
       模型：ModelRouter（偏 cloud，因有 tools）
       工具：全部 − spawn_agent + MCP
       stream_chat（合成 session id，不落库为独立 Session）
       工具 → dispatch_sub_tool（Ask=拒绝）
  → emit subagent-done
  → 文本作为父工具的 tool_result 返回
```

**要点**：禁止嵌套 spawn；子会话历史不进 SQLite sessions 表。

---

## 6. 模型选择 / 路由

**每轮循环选 Profile**（`chat/service.rs`）：

```text
1. Session.profile_id（会话钉选）且 enabled
2. 否则若非 auto_mode → AppConfig.active_profile_id
3. 否则 ModelRouter::pick
4. 再否则旧版 JSON provider 合成 __legacy__
```

**ModelRouter**（`models/router.rs`）：

- 有 tools → 偏好 `cloud`，否则偏好 `local`
- 过滤：enabled、context_window、未在冷却
- 取最高 weight；可选 tags；同权 round-robin
- 成功/失败回写；连续失败进入冷却（约 60s / 300s）

**配置 UI**：`src/views/models/index.tsx`、聊天栏 `ModelPicker`  
**命令**：`model_profile_*`、`model_profile_pin_session`、`model_profile_activate`

---

## 7. 意图软路由

**触发**：每次 `send_message`，在组 prompt 之前。  
**配置**：智能配置 → 意图规则（`intent_rule_*`）

```text
intent::run(input)
  normalize::prepare
  → score::evaluate          # cache 中启用规则：关键词 × weight 累加
  → confidence::assess       # ≥0.7 视为高置信
  → classify::classify       # 预留，当前恒为 None
  → fusion::fuse
  → enrich::enrich           # needs_tools 等派生字段
  → validate::validate
  → fallback::apply          # 短句 Unknown → general_chat
```

**消费方式**：`format_for_prompt` → system prompt 中的 `<user_intent>...</user_intent>`  
**不短路** Agent Loop；规则在 SQLite，热路径读内存缓存。

**意图类别**：`general_chat` / `use_tools` / `content_publish` / `account_lookup` / `unknown`

---

## 8. System Prompt 组装

**触发**：`build_system_prompt`（每次发送）

```text
1. agents::format_persona(active_agent)
2. intent::format_for_prompt
3. kbase::search(top 3) → format_for_prompt
4. scripts::format_for_prompt(skills, query, agent.skills 白名单)
     None = 不限；Some([]) = 无技能；否则按名单
```

知识 / 技能 CRUD 更新内存与持久化，影响后续轮次。

---

## 9. 会话与 Workspace 绑定

```text
Agent 创建/种子
  → app_data/workspaces/{slug}/{input,output,tmp,memory,logs}

ensure_session（首次无 session 时）
  → 解析 agent_id（显式 → 默认激活 → 第一个启用）
  → 快照 AgentProfile.workspace_dir → Session.workspace_dir
  → SQLite 持久化

此后整段会话工具都用 session.workspace_dir
切换 Agent 不改写历史会话的 workspace
```

---

## 10. 账号保险柜

**触发**：账号页设置/解锁主密码、查看密钥

```text
vault_setup
  → Argon2id 盐 + 派生密钥
  → AES-256-GCM 校验器入库
  → 明文存量密钥迁移加密

vault_unlock
  → 校验密码 → 内存持有密钥（约 30 分钟 TTL）

account_reveal / add/update
  → 需已解锁 → decrypt / encrypt 敏感字段
```

**文件**：`src-tauri/src/accounts/{vault,service,commands}.rs`  
**前端**：`src/views/accounts/components/*`

---

## 11. Telegram 渠道

**触发**：渠道页启用 / 启动 Telegram（启动时**不会**自动轮询）

```text
channel_enable / channel_telegram_start
  → 持久化渠道配置
  → run_poll_loop：getUpdates
  → 发送者白名单
  → chat_id ↔ session_id 映射
  → chat::service::send_message（完整 Agent Loop）
  → emit sessions-changed { source: telegram }
  → 取最后一条 Assistant → Telegram sendMessage
```

**文件**：`src-tauri/src/channels/mod.rs`

---

## 12. 发布桥 / 浏览器扩展

**地址**：`127.0.0.1:17890`（启动即起）

| 能力 | 流程 |
|------|------|
| 发布到浏览器 | `publish_to_browser` → 准备草稿 → 打开 `/bridge?id=` |
| 扩展聊天 SSE | `POST /chat/send` → 监听 `stream-chunk` 转 SSE → 后台 `send_message` |
| 页绑定 | `page_key` ↔ `session_id` 持久化 |
| 其它 | 扩展侧可读权限模式、模型、会话 CRUD |

**文件**：`publish/mod.rs`、`bridge/mod.rs`、`src/views/publish/PublishModal.tsx`

---

## 事件一览（前端订阅）

| 事件 | 含义 |
|------|------|
| `stream-chunk` | 助手文本流式增量 / done |
| `thinking-chunk` | 思考过程增量 |
| `tool-call` | 开始调用工具 |
| `tool-result` | 工具返回 |
| `permission-request` | 权限确认弹窗 |
| `session-token-usage` | 本轮 token |
| `subagent-start` / `subagent-done` | 子 Agent 生命周期 |
| `sessions-changed` | Telegram / 扩展写入会话后刷新列表 |

主订阅位置：`src/stores/useChatStore.ts`

---

## 面试口述版（30 秒）

> 用户发消息进 `chat_send`：先锁定会话 workspace，再跑关键词意图软路由注入 prompt，然后进入 Agent Loop——按 Profile 路由选模型，SSE 流式生成；若模型要调工具，先过权限引擎，再执行内置工具、MCP 或 spawn 子 Agent，结果回灌继续推理，直到纯文本结束。整条链路通过 Tauri 事件推到 React；Telegram 和浏览器扩展复用同一 `send_message`。

---

## 与简历文档的关系

- 项目经历文稿：[`chatcms-project.md`](./chatcms-project.md)
- 本文侧重：**可画图的主流程与调用链**，面试时按编号 2→3→5→7 讲即可覆盖核心。
