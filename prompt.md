# ChatCMS — 开发进度记录

## 项目定位
用 **React + Tauri (Rust)** 实现 OpenHarness 同类功能的桌面 Agent 应用。
参考项目：`/Users/xukui/demo-workspace/OpenHarness`（Python 实现）

---

## Phase 1 骨架 ✅ 已完成

### 技术栈
- 前端：React 19 + TypeScript + Vite + Zustand + 自定义 CSS（Tailwind v4 已装备用）
- 后端：Rust + Tauri v2
- HTTP 流式：reqwest 0.12 + SSE + futures-util
- 状态持久化：tauri-plugin-store（已装，未接入）

### Rust 模块
```
src-tauri/src/
├── lib.rs              — 5个 Tauri commands
├── agent/mod.rs        — Agent Loop（session 管理 + 调 provider）
├── config/mod.rs       — AppConfig / ProviderConfig（Anthropic / OpenAI）
├── memory/mod.rs       — Session + Message 数据结构
├── provider/mod.rs     — SSE 流式，emit "stream-chunk" 给前端
└── tools/mod.rs        — 占位，Phase 2 填
```

### React 模块
```
src/
├── types/index.ts          — 前后端共享类型
├── store/chat.ts           — Zustand store，监听 stream-chunk 事件
├── components/
│   ├── Sidebar.tsx         — 会话列表 + 新建按钮
│   ├── ChatWindow.tsx      — 消息流 + 流式光标 + 输入框
│   └── SettingsModal.tsx   — provider / api key / model 配置
└── App.tsx                 — 布局组合
```

### 已暴露的 Tauri Commands
| Command | 说明 |
|---------|------|
| `chat_send` | 发消息（流式），返回 session_id |
| `session_list` | 获取所有会话摘要列表 |
| `session_get` | 获取指定会话完整内容 |
| `config_get` | 读取当前 provider 配置 |
| `config_set` | 更新 provider / api key / model |

### 数据流
```
sendMessage
  → Tauri chat_send
  → Rust provider::stream_chat (SSE)
  → emit("stream-chunk")
  → Zustand listener
  → React 实时渲染
```

### 启动方式
```bash
pnpm tauri dev
# 启动后在 Settings(⚙) 填入 API Key，支持 Anthropic / OpenAI 兼容接口
```

---

## Phase 2 计划（下一步）

1. **Tool 调用**：在 `tools/mod.rs` 实现 `read_file` / `write_file` / `bash` 三个基础工具
2. **Agent Loop 完整化**：tool_call → observe → continue 循环（目前只有单轮对话）
3. **Permission 中间件**：危险工具调用前的 ask/allow/deny 前端弹窗
4. **Session 持久化**：目前 session 存内存，重启丢失；接入 SQLite 或 tauri-plugin-store

## Phase 3 计划

- MCP server 对接（子进程 stdio 协议）
- Skills / Hooks 系统
- 多 provider / 多 profile

## Phase 4 计划

- Multi-agent 协调
- IM Channels（Telegram / Slack）
- Vector memory（本地 embedding）
