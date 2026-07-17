#!/usr/bin/env bash
# 一键启动开发环境：后端 + 前端并发
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  [ -n "${BACK_PID:-}" ] && kill "$BACK_PID" 2>/dev/null || true
  [ -n "${FRONT_PID:-}" ] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "▶ 启动后端 (127.0.0.1:18791) ..."
(cd "$ROOT/apps/server" && uvicorn videomind.main:app --reload --host 127.0.0.1 --port 18791) &
BACK_PID=$!

echo "▶ 启动前端 (localhost:1420) ..."
(cd "$ROOT/apps/desktop/web" && npm run dev) &
FRONT_PID=$!

echo ""
echo "✓ 后端:  http://127.0.0.1:18791/api/v1/system/healthz"
echo "✓ 前端:  http://localhost:1420"
echo "按 Ctrl+C 退出"

wait
