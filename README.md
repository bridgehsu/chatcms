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

## 打包

脚本在 `bin/`，产物复制到 `release/`。

```bash
# 当前系统自动选择
pnpm package
# 或
./bin/package.sh

# macOS → .app + .dmg（产物：release/mac/）
pnpm package:mac
./bin/package-mac.sh --universal   # 可选：通用二进制
./bin/package-mac.sh --no-sign     # 跳过签名

# Windows → NSIS 安装包（须在 Windows 本机执行；产物：release/windows/）
pnpm package:win
./bin/package-windows.sh --msi
# 或 PowerShell：
powershell -ExecutionPolicy Bypass -File bin/package-windows.ps1 -Msi
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
