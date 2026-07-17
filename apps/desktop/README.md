# VideoMind AI Desktop (Tauri + React)

## 目录

- `web/` — React 18 + Vite + TypeScript + Tailwind 前端
- `src-tauri/` — Tauri 2 (Rust) 主进程

## 开发

```bash
# 仅前端（浏览器调试，API 经 vite proxy 转发到后端 18791）
cd web && npm install && npm run dev    # http://localhost:1420

# 桌面壳（自动拉起前端）
cargo tauri dev
```

> 桌面壳需先在项目根 `make server` 启动后端。开发阶段不打包 Python sidecar，
> 前端通过 vite proxy 访问 `127.0.0.1:18791`。

## 打包

```bash
# 生成图标（首次，需要一张 1024x1024 源图）
cargo tauri icon path/to/icon.png

cargo tauri build
```

## Sidecar（P4 实现）

当前 Rust 仅加载 webview。P4 将：
1. 用 PyInstaller 把 `apps/server` 打包为单可执行文件。
2. Rust 启动时探测空闲端口，spawn sidecar 子进程。
3. 通过 webview `eval` 注入 `window.__VIDEOMIND_API_BASE__ = http://127.0.0.1:<port>/api/v1`。
4. 退出时优雅终止子进程。
