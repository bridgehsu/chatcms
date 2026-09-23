#!/usr/bin/env bash
set -e

# 清理旧进程和端口。
# 注意：不要 `pkill -f chatcms`——会误杀 cargo/rustc（命令行路径含仓库名 chatcms）。
pkill -f 'pnpm tauri dev' 2>/dev/null || true
pkill -f '[v]ite' 2>/dev/null || true
# 仅结束已启动的应用二进制（若存在）
pkill -x 'chatcms' 2>/dev/null || true
lsof -ti:17890 | xargs kill -9 2>/dev/null || true
lsof -ti:15420 | xargs kill -9 2>/dev/null || true

sleep 1

exec pnpm tauri dev
