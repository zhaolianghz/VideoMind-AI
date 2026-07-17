#!/usr/bin/env bash
# 打包 Python 后端为 sidecar（onedir 模式 + 含 native 库，全功能）。
# 产物: apps/desktop/src-tauri/bin/videomind-sidecar.tar.gz  (压缩包，Tauri 作为 resource，首次启动 Rust 解压)
# 用法: ./scripts/build_sidecar.sh
# 注意: faster-whisper/weasyprint 含 native 库，必须在目标 OS 上打包（mac 打 mac，win 打 win）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/apps/server"
BIN_ROOT="$ROOT/apps/desktop/src-tauri/bin"
PKG="${PKG:-videomind-sidecar}"

cd "$SERVER"
echo "▶ 打包 sidecar (onedir, 含 whisper/weasyprint native) → $BIN_ROOT/$PKG.tar.gz"
rm -rf "$BIN_ROOT/$PKG" "$BIN_ROOT/$PKG.tar.gz"

PYINSTALLER="${PYINSTALLER:-pyinstaller}"

# onedir + collect-all native（faster_whisper/ctranslate2/weasyprint）→ 全功能
"$PYINSTALLER" --name "$PKG" \
  --collect-submodules videomind \
  --collect-all yt_dlp \
  --collect-all faster_whisper \
  --collect-all ctranslate2 \
  --collect-all weasyprint \
  --collect-all markdown \
  --hidden-import openai --hidden-import anthropic \
  --exclude-module pytest \
  --distpath "$BIN_ROOT" \
  --workpath /tmp/vm-py-build --specpath /tmp/vm-py-spec \
  --clean --noconfirm \
  run_sidecar.py

# 压缩为 tar.gz（Tauri 打包目录 resource 会报错，改用压缩包 + 运行时 Rust 解压）
tar -czf "$BIN_ROOT/$PKG.tar.gz" -C "$BIN_ROOT" "$PKG"
rm -rf "$BIN_ROOT/$PKG"

echo "✓ 全功能 sidecar 压缩包:"
ls -lh "$BIN_ROOT/$PKG.tar.gz"
echo ""
echo "下一步: cd apps/desktop && npm run build"
