#!/usr/bin/env bash
# ChatCMS 打包入口：按当前系统选择 mac / windows 脚本。
# 用法：
#   ./bin/package.sh
#   ./bin/package.sh mac [--universal] [--debug]
#   ./bin/package.sh windows [--msi] [--debug]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"
shift || true

case "$TARGET" in
  "" )
    case "$(uname -s)" in
      Darwin) exec bash "$ROOT/bin/package-mac.sh" "$@" ;;
      MINGW*|MSYS*|CYGWIN*|Windows_NT)
        exec bash "$ROOT/bin/package-windows.sh" "$@"
        ;;
      *)
        echo "当前系统 $(uname -s) 未提供打包脚本。请显式指定："
        echo "  ./bin/package.sh mac"
        echo "  ./bin/package.sh windows"
        exit 1
        ;;
    esac
    ;;
  mac|macos|darwin)
    exec bash "$ROOT/bin/package-mac.sh" "$@"
    ;;
  win|windows|win32)
    exec bash "$ROOT/bin/package-windows.sh" "$@"
    ;;
  -h|--help|help)
    cat <<'EOF'
ChatCMS 打包

  ./bin/package.sh                 # 自动识别当前系统
  ./bin/package.sh mac             # macOS → .app + .dmg
  ./bin/package.sh mac --universal # macOS 通用二进制 (arm64+x86_64)
  ./bin/package.sh windows         # Windows → NSIS 安装包 (.exe)
  ./bin/package.sh windows --msi   # 额外打 MSI

产物目录：
  release/mac/
  release/windows/
  （同时保留 Tauri 默认路径 src-tauri/target/.../bundle/）
EOF
    ;;
  *)
    echo "未知目标: $TARGET"
    echo "可用: mac | windows"
    exit 1
    ;;
esac
