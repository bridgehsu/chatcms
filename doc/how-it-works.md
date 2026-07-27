# 「输入一句话 → 执行操作」实现原理

## 整体流程

```
用户输入
  → 前端 ChatWindow
  → Tauri IPC (chat_send)
  → Rust agent loop
  → LLM (Claude/GPT) 决策
  → 工具调用
  → 结果回流
  → 用户看到结果
```

---

## 分层拆解

### 第一层：用户意图 → LLM 决策

你输入「帮我读一下 /tmp/foo.txt 的内容」，这句话被打包成 `messages` 数组发给 LLM。同时，我们在请求里附带了**工具定义**（tool definitions），告诉 LLM：「你现在有这些能力：`read_file`、`write_file`、`bash`、`spawn_agent`，以及所有 MCP 工具」。

LLM 看到工具列表 + 你的请求，**自己决定**是直接回复还是调用某个工具。这是 Anthropic / OpenAI 的 **Function Calling / Tool Use** 机制，由模型内部推理完成，不是规则匹配。

### 第二层：Agent Loop（核心）

Rust 端的 `agent/mod.rs` 跑一个 **loop**：

1. 把消息发给 LLM，**流式**接收响应
2. 解析响应：
   - 如果只有文字 → 结束，展示给用户
   - 如果有 `tool_use` 块 → 进入工具执行阶段
3. 执行工具，把结果拼成 `tool_result` 追加到消息历史
4. **带着工具结果重新发给 LLM**，让它继续推理
5. 回到第 1 步

这个循环使得 LLM 能**链式操作**：比如先 `bash ls`，看到文件列表，再 `read_file` 读具体文件，再总结给你。

### 第三层：工具路由

`dispatch_tool` 根据工具名分流：

| 工具名 | 路由 |
|--------|------|
| `spawn_agent` | 启动一个子 agent（独立 loop，不继承父会话，不能再嵌套 spawn） |
| `mcp__server__tool` | 转发给对应的 MCP 子进程（JSON-RPC over stdio） |
| `bash` / `write_file` | 先弹 Permission 弹窗等用户确认，再执行 |
| `read_file` | 直接执行 |

### 第四层：结果展示

每一步都通过 Tauri 的 **emit 事件**实时推送到前端：

| 事件 | 含义 |
|------|------|
| `stream-chunk` | 文字边生成边显示（流式光标） |
| `tool-call` | 显示「正在调用 xxx 工具」 |
| `tool-result` | 显示工具返回结果 |
| `permission-request` | 权限弹窗（允许一次 / 本会话允许或拒绝）；当前模式来自会话工具栏 |
| `subagent-start` | 显示子 agent 启动和任务描述 |
| `subagent-done` | 标记子 agent 完成 |

---

## 关键设计点

**LLM 是决策大脑，不是执行者。** 它只负责「我要调用什么工具、参数是什么」，实际执行在 Rust 侧。

**工具定义是桥梁。** 你加一个新工具（比如 MCP server 连上来），LLM 自动就知道能用，不需要任何额外训练。

**Knowledge Memory 是上下文注入。** 你每次发消息，系统会先搜索知识库里的相关条目，把它们塞进 system prompt，让 LLM「有记忆」地回答。

---

## 一句话概括

> 用户输入 → LLM 用 Tool Use 协议规划行动 → Rust Agent Loop 执行并把结果喂回 LLM → LLM 基于结果继续推理 → 直到不再需要调用工具为止。
