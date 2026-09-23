# ChatCMS

Tauri + React 桌面 Agent。侧栏「媒体采集 → 采集任务」通过 HTTP 连接 [chatcms-collect](../chatcms-collect) FastAPI Worker；「调度中心」用于配置 n8n 风格工作流。

## 文档

- 在线文档站（GitHub Pages）：[https://bridgehsu.github.io/chatcms/](https://bridgehsu.github.io/chatcms/)
- 本地预览：在**仓库根目录**执行 `pnpm docs:dev` → [http://localhost:5173/](http://localhost:5173/)  
  （也可 `cd docs && pnpm dev`；不要在 docs 里跑 `pnpm run dev`，那是桌面应用）
- 流程图源文件：[`docs/drawio/`](./docs/drawio/)

自定义域名：在仓库 Settings → Pages 绑定域名，并将构建改为 `DOCS_BASE=/ pnpm docs:build`（见 `.github/workflows/docs.yml`）。

## 启动

```bash
# 终端 1：采集 Worker（可选）
cd ../chatcms-collect
uv run uvicorn api.main:app --port 8080 --reload

# 终端 2：桌面端
cd ../chatcms
pnpm install
pnpm tauri dev
# 或：bash scripts/dev.sh
```

采集任务默认 Base URL：`http://127.0.0.1:8080`。

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
