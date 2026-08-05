# ChatCMS

Tauri + React 桌面 Agent。侧栏「采集中心」通过 HTTP 连接 [chatcms-collect](../chatcms-collect) FastAPI Worker。

## 启动

```bash
# 终端 1：采集 Worker
cd ../chatcms-collect
uv run uvicorn api.main:app --port 8080 --reload

# 终端 2：桌面端
cd ../chatcms
pnpm install
pnpm tauri dev
```

采集中心默认 Base URL：`http://127.0.0.1:8080`。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
