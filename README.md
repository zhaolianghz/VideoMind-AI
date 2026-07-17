# VideoMind AI · 视频智研助手

> AI Video Intelligence OS —— 视频采集 → ASR → AI 分析 → 结构化报告 → 知识库

状态：**P0 骨架搭建中**

## 目录结构

```
VideoMind-AI/
├── docs/              # PRD / 技术设计 / AI 引擎设计
├── apps/
│   ├── server/        # Python FastAPI 后端（AI 管线）
│   └── desktop/       # Tauri (Rust) + React 桌面应用
│       ├── web/       # React + Vite + TS 前端
│       └── src-tauri/ # Rust 主进程
├── scripts/
├── docker-compose.yml # 开发用 Redis
└── Makefile
```

## 快速开始（开发模式）

```bash
# 1. 安装依赖
make install

# 2. （可选）起 Redis（P3 任务队列才需要）
docker compose up -d redis

# 3. 起后端
make server            # http://127.0.0.1:18791  healthz: /api/v1/system/healthz

# 4. 起前端（另开终端）
make web               # http://localhost:1420  (API 走 vite proxy → 后端)

# 5. 桌面壳（另开终端）
make tauri
```

## 技术栈

- **桌面壳**：Tauri 2 (Rust)
- **前端**：React 18 + TypeScript + Vite + Tailwind
- **后端**：Python 3.11 + FastAPI + SQLModel + SQLite
- **任务队列（P3）**：Celery + Redis
- **核心管线（P1-P2）**：yt-dlp / FFmpeg / faster-whisper / 多模型路由

## 文档

- [PRD](docs/PRD.md)
- [技术设计](docs/TECH_DESIGN.md)
- [AI 引擎设计](docs/AI_ENGINE_DESIGN.md)
