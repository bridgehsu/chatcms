#!/usr/bin/env bash
# 在 macOS 上打包 ChatCMS（.app + .dmg）
# 用法：
#   ./bin/package-mac.sh
#   ./bin/package-mac.sh --universal   # arm64 + x86_64
#   ./bin/package-mac.sh --debug       # debug 构建
#   ./bin/package-mac.sh --no-sign     # 跳过代码签名
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "错误：package-mac.sh 只能在 macOS 上运行（当前: $(uname -s)）"
  exit 1
fi

UNIVERSAL=0
DEBUG=0
NO_SIGN=0
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --universal) UNIVERSAL=1 ;;
    --debug) DEBUG=1 ;;
    --no-sign) NO_SIGN=1 ;;
    -h|--help)
      sed -n '2,10p' "$0"
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
OUT_DIR="$ROOT/release/mac"
BUNDLE_ROOT=""

echo "==> ChatCMS macOS 打包 v${VERSION}"
echo "    工作目录: $ROOT"

ARGS=(tauri build --bundles app,dmg)
if [[ "$DEBUG" -eq 1 ]]; then
  ARGS+=(--debug)
  BUNDLE_ROOT="$ROOT/src-tauri/target/debug/bundle"
else
  BUNDLE_ROOT="$ROOT/src-tauri/target/release/bundle"
fi
if [[ "$UNIVERSAL" -eq 1 ]]; then
  echo "==> 检查 universal 目标"
  rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
  ARGS+=(--target universal-apple-darwin)
  if [[ "$DEBUG" -eq 1 ]]; then
    BUNDLE_ROOT="$ROOT/src-tauri/target/universal-apple-darwin/debug/bundle"
  else
    BUNDLE_ROOT="$ROOT/src-tauri/target/universal-apple-darwin/release/bundle"
  fi
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
# 复制 dmg / app 到 release/mac
shopt -s nullglob
COPIED=0
for f in "$BUNDLE_ROOT"/dmg/*.dmg; do
  cp -f "$f" "$OUT_DIR/"
  echo "    已复制: $(basename "$f")"
  COPIED=1
done
for f in "$BUNDLE_ROOT"/macos/*.app; do
  dest="$OUT_DIR/$(basename "$f")"
  rm -rf "$dest"
  cp -R "$f" "$dest"
  echo "    已复制: $(basename "$f")"
  COPIED=1
done
shopt -u nullglob

if [[ "$COPIED" -eq 0 ]]; then
  echo "警告：未在 $BUNDLE_ROOT 找到 dmg/app，请检查 Tauri 输出。"
  echo "    常见路径: src-tauri/target/release/bundle/{dmg,macos}"
  exit 1
fi

echo "==> 完成"
echo "    产物目录: $OUT_DIR"
ls -lah "$OUT_DIR"
