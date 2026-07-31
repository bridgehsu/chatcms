#!/usr/bin/env bash
set -e

# 清理旧进程和端口
pkill -f 'pnpm tauri dev' 2>/dev/null || true
pkill -f 'vite'           2>/dev/null || true
pkill -f 'chatcms'        2>/dev/null || true
lsof -ti:17890 | xargs kill -9 2>/dev/null || true
lsof -ti:15420 | xargs kill -9 2>/dev/null || true

sleep 1

exec pnpm tauri dev
