#!/usr/bin/env bash
# 在 Windows（Git Bash / MSYS / CI）上打包 ChatCMS（NSIS / 可选 MSI）
# 用法：
#   ./bin/package-windows.sh
#   ./bin/package-windows.sh --msi
#   ./bin/package-windows.sh --debug
#   ./bin/package-windows.sh --no-sign
#
# 说明：须在 Windows 本机执行；不支持从 macOS 交叉编译。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OS="$(uname -s 2>/dev/null || echo unknown)"
case "$OS" in
  MINGW*|MSYS*|CYGWIN*) ;;
  *)
    # 某些环境 uname 仍是 Linux/Darwin；再用 OSTYPE / PROCESSOR 兜底
    if [[ "${OSTYPE:-}" != msys* && "${OSTYPE:-}" != cygwin* && -z "${WINDIR:-}" ]]; then
      echo "错误：package-windows.sh 只能在 Windows 上运行（当前: $OS）"
      echo "请在 Windows 安装 Rust + WebView2 + pnpm 后执行本脚本，"
      echo "或使用: powershell -File bin/package-windows.ps1"
      exit 1
    fi
    ;;
esac

WITH_MSI=0
DEBUG=0
NO_SIGN=0
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --msi) WITH_MSI=1 ;;
    --debug) DEBUG=1 ;;
    --no-sign) NO_SIGN=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      EXTRA_ARGS+=("$1")
      ;;
  esac
  shift
done

command -v pnpm >/dev/null || { echo "需要 pnpm"; exit 1; }
command -v rustc >/dev/null || { echo "需要 Rust (rustc)"; exit 1; }

VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")"
OUT_DIR="$ROOT/release/windows"
BUNDLES="nsis"
if [[ "$WITH_MSI" -eq 1 ]]; then
  BUNDLES="nsis,msi"
fi

echo "==> ChatCMS Windows 打包 v${VERSION}"
echo "    工作目录: $ROOT"
echo "    bundles: $BUNDLES"

ARGS=(tauri build --bundles "$BUNDLES")
if [[ "$DEBUG" -eq 1 ]]; then
  ARGS+=(--debug)
  BUNDLE_ROOT="$ROOT/src-tauri/target/debug/bundle"
else
  BUNDLE_ROOT="$ROOT/src-tauri/target/release/bundle"
fi
if [[ "$NO_SIGN" -eq 1 ]]; then
  ARGS+=(--no-sign)
fi
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  ARGS+=("${EXTRA_ARGS[@]}")
fi

echo "==> pnpm ${ARGS[*]}"
pnpm exec "${ARGS[@]}"

mkdir -p "$OUT_DIR"
COPIED=0
# Git Bash 下路径兼容
copy_glob() {
  local dir="$1"
  local pattern="$2"
  if [[ -d "$dir" ]]; then
    # shellcheck disable=SC2086
    for f in "$dir"/$pattern; do
      [[ -e "$f" ]] || continue
      cp -f "$f" "$OUT_DIR/"
      echo "    已复制: $(basename "$f")"
      COPIED=1
    done
  fi
}

copy_glob "$BUNDLE_ROOT/nsis" "*.exe"
copy_glob "$BUNDLE_ROOT/msi" "*.msi"

if [[ "$COPIED" -eq 0 ]]; then
  echo "警告：未在 $BUNDLE_ROOT 找到 nsis/msi 产物。"
  echo "    常见路径: src-tauri/target/release/bundle/{nsis,msi}"
  exit 1
fi

echo "==> 完成"
echo "    产物目录: $OUT_DIR"
ls -lah "$OUT_DIR"
