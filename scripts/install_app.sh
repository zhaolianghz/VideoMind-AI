#!/usr/bin/env bash
# 覆盖安装：把 tauri 构建产物装进 /Applications（同名替换，杜绝多副本）。
# 用法: ./scripts/install_app.sh          # 安装已构建的产物并启动
#       BUILD=1 ./scripts/install_app.sh  # 先 tauri build 再安装
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="VideoMind AI.app"
BUILT="$ROOT/apps/desktop/src-tauri/target/release/bundle/macos/$APP_NAME"
DEST="/Applications/$APP_NAME"

if [[ "${BUILD:-0}" == "1" ]]; then
  echo "▶ tauri build …"
  (cd "$ROOT/apps/desktop" && npm run build)
fi

[[ -d "$BUILT" ]] || { echo "✗ 未找到构建产物：$BUILT（先运行 BUILD=1 $0）"; exit 1; }

echo "▶ 退出运行中的应用"
osascript -e 'quit app "VideoMind AI"' 2>/dev/null || true
sleep 2
pkill -f videomind-sidecar 2>/dev/null || true

echo "▶ 覆盖安装 → $DEST"
rm -rf "$DEST"
cp -R "$BUILT" /Applications/

# 删除构建目录里的 .app 副本，避免 Spotlight/启动台出现“两个应用”
# （dmg 分发包保留在 bundle/dmg/ 下）
rm -rf "$BUILT"

echo "▶ 启动新版本"
open "$DEST"
echo "✓ 完成：$(stat -f '%Sm' "$DEST/Contents/MacOS/videomind-desktop")"
