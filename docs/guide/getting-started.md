# 安装与启动

## 环境

- Node.js 20+（建议）与 [pnpm](https://pnpm.io/)
- Rust 工具链（Tauri 需要）
- macOS / Windows（打包脚本见仓库 `bin/`）

## 安装

```bash
git clone https://github.com/bridgehsu/chatcms.git
cd chatcms
pnpm install
```

## 开发启动

```bash
# 推荐：清理端口后启动
bash scripts/dev.sh

# 或
pnpm tauri dev
```

前端开发服务器默认：`http://localhost:15420/`。

### 可选：采集 Worker

```bash
cd ../chatcms-collect
uv run uvicorn api.main:app --port 8080 --reload
```

采集任务默认 Base URL：`http://127.0.0.1:8080`。

## 文档站本地预览

```bash
pnpm docs:dev
```

浏览器打开 [http://localhost:5173/](http://localhost:5173/)。

```bash
pnpm docs:build
pnpm docs:preview
```

## 打包

```bash
pnpm package          # 按当前系统
pnpm package:mac      # → release/mac/
pnpm package:win      # Windows 本机 → release/windows/
```

详见仓库根目录 [README](https://github.com/bridgehsu/chatcms#readme)。
