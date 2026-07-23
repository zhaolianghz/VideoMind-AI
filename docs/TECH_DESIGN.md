# VideoMind AI 技术设计与实现方案 (TDD)

> 配套文档：[PRD.md](./PRD.md)
> 文档版本：V1.0 ｜ 对应产品版本：V1.0 MVP
> 编写日期：2024-05

---

## 一、架构总览

### 1.1 进程拓扑

VideoMind AI 是一个 **"轻壳 + 本地服务"** 架构。Tauri 提供跨平台 GUI 壳，真正的 AI 管线跑在打包后的 Python FastAPI 本地服务里，两者通过 `http://127.0.0.1:<port>` 通信。

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                        │
│  ┌───────────────────────┐    ┌──────────────────────────┐  │
│  │  Webview (React UI)   │    │  Rust Main Process       │  │
│  │  - 任务管理界面        │◄──►│  - sidecar 生命周期管理   │  │
│  │  - 报告/播放器         │ IPC│  - 系统托盘/通知          │  │
│  │  - 设置               │    │  - 文件/对话框            │  │
│  └──────────┬────────────┘    └──────────┬───────────────┘  │
└─────────────┼─────────────────────────────┼─────────────────┘
              │ HTTP (localhost)             │ spawn
              ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Python FastAPI Local Server (sidecar)          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │  API Layer  │  │  Task Queue  │  │  Core Engines     │   │
│  │  (FastAPI)  │──│  (Celery+    │──│  - yt-dlp 采集     │   │
│  │             │  │   Redis)     │  │  - FFmpeg 解封装   │   │
│  └─────────────┘  └──────────────┘  │  - faster-whisper  │   │
│                                      │  - LLM Router      │   │
│  ┌──────────────────────────────────│  - Report Builder  │   │
│  │ SQLite (元数据) + Chroma (向量)  │  - RAG Retrieval   │   │
│  └──────────────────────────────────┴───────────────────┘   │
└─────────────────────────────────────────────────────────────┘
              │
              ▼ HTTPS（仅文本/必要元数据）
   ┌────────────────────┐
   │  Cloud LLM APIs    │  OpenAI / Anthropic / 通义 / DeepSeek
   └────────────────────┘
```

### 1.2 关键技术决策

| 决策点 | 选型 | 理由 |
|--------|------|------|
| 桌面壳 | **Tauri 2.x** | 安装包 <10MB，内存占用低；Rust 主进程便于管理 Python 子进程生命周期 |
| 前端框架 | **React 18 + TS + Vite + Tailwind** | 生态成熟，组件库可选 shadcn/ui；Vite 构建快 |
| 后端 | **Python 3.11 + FastAPI** | AI 管线（whisper/yt-dlp/chroma）全在 Python 生态，避免跨语言桥接 |
| 任务队列 | **Celery + Redis** | 长任务（下载/ASR/分析）异步化，支持重试/优先级/断点恢复 |
| 元数据库 | **SQLite + SQLModel** | 单文件零运维，桌面端首选；SQLModel = SQLAlchemy + Pydantic |
| 向量库 | **Chroma (V2)** | 纯 Python，本地嵌入式，无需独立服务；V3 再切 Milvus |
| ASR | **faster-whisper** | CTranslate2 加速，INT8 量化，CPU 也能跑，GPU 提速 4-8x |
| 打包分发 | **PyInstaller**（后端）+ **Tauri bundler**（壳） | Python 冻结成单可执行文件作为 Tauri sidecar |

### 1.3 Sidecar 通信约定
- Tauri 启动时：扫描空闲端口 → 以 `--port <n> --data-dir <user_data>` 参数 spawn 打包后的 Python 二进制。
- 心跳：Rust 侧每 2s 轮询 `/healthz`，就绪后再加载前端。
- 退出时：Rust 向 Python 进程发 SIGTERM，3s 超时后 SIGKILL。
- 前端所有请求走 `http://127.0.0.1:<port>/api/v1`，端口由 Rust 通过 IPC 注入 webview。

---

## 二、工程目录结构（Monorepo）

```
VideoMind-AI/
├── docs/                           # 文档
│   ├── PRD.md                      # 产品需求
│   └── TECH_DESIGN.md              # 本文档
│
├── apps/
│   ├── desktop/                    # Tauri 桌面应用
│   │   ├── src-tauri/              # Rust 主进程
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── sidecar.rs      # Python 子进程管理
│   │   │   │   ├── port.rs         # 空闲端口探测
│   │   │   │   └── commands.rs     # 前端可调用的 IPC 命令
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json     # sidecar/权限/打包配置
│   │   │   └── icons/
│   │   ├── web/                    # 前端 (React + Vite + TS)
│   │   │   ├── src/
│   │   │   │   ├── main.tsx
│   │   │   │   ├── App.tsx
│   │   │   │   ├── pages/          # 工作台/新建任务/视频库/报告/知识库/设置
│   │   │   │   ├── components/     # TaskCard/VideoPlayer/ReportView/...
│   │   │   │   ├── api/            # axios 封装 + 类型定义
│   │   │   │   ├── stores/         # zustand 状态
│   │   │   │   ├── hooks/
│   │   │   │   └── i18n/           # zh / en
│   │   │   ├── package.json
│   │   │   ├── vite.config.ts
│   │   │   └── tsconfig.json
│   │   └── README.md
│   │
│   └── server/                     # Python FastAPI 后端
│       ├── videomind/
│       │   ├── __init__.py
│       │   ├── main.py             # FastAPI 应用入口 / lifespan
│       │   ├── config.py           # pydantic-settings 配置
│       │   ├── api/                # ── API 路由层 ──
│       │   │   ├── deps.py         # 依赖注入
│       │   │   ├── v1/
│       │   │   │   ├── tasks.py        # 任务 CRUD / 状态
│       │   │   │   ├── videos.py       # 视频库
│       │   │   │   ├── reports.py      # 报告/导出
│       │   │   │   ├── transcripts.py  # 字幕
│       │   │   │   ├── knowledge.py    # RAG 问答 (V2)
│       │   │   │   ├── settings.py     # 模型/Cookie/路径配置
│       │   │   │   └── system.py       # healthz / 版本
│       │   │   └── ws.py           # WebSocket 任务进度推送
│       │   ├── core/               # ── 核心引擎 ──
│       │   │   ├── collector/      # 视频采集
│       │   │   │   ├── yt_dlp_runner.py
│       │   │   │   ├── platforms.py    # 平台反爬策略/UA
│       │   │   │   └── cookies.py
│       │   │   ├── media/          # 音视频处理
│       │   │   │   ├── ffmpeg.py       # 提取音频/关键帧/切片
│       │   │   │   └── scene_detect.py # 场景切换检测 (V2)
│       │   │   ├── asr/            # 语音识别
│       │   │   │   ├── whisper_engine.py  # faster-whisper 封装
│       │   │   │   ├── model_selector.py  # 模型自适应选择
│       │   │   │   └── subtitle.py        # SRT/VTT 生成
│       │   │   ├── analyzer/       # AI 分析
│       │   │   │   ├── router.py       # 多模型路由
│       │   │   │   ├── providers/      # openai/anthropic/qwen/deepseek
│       │   │   │   ├── templates.py    # Prompt 模板注册
│       │   │   │   ├── chunker.py      # 长文本切片
│       │   │   │   └── ocr.py          # 关键帧 OCR (V2)
│       │   │   ├── reporter/       # 报告生成
│       │   │   │   ├── markdown.py
│       │   │   │   ├── pdf.py          # 渲染 (weasyprint/playa)
│       │   │   │   ├── pptx.py         # V2
│       │   │   │   └── mindmap.py      # V2
│       │   │   └── knowledge/      # RAG
│       │   │       ├── chroma_store.py # V2
│       │   │       ├── embedder.py     # V2
│       │   │       └── retriever.py    # V2
│       │   ├── tasks/              # ── Celery 任务 ──
│       │   │   ├── celery_app.py
│       │   │   ├── pipeline.py     # 任务编排 (状态机)
│       │   │   ├── steps/          # 各阶段 step
│       │   │   │   ├── collect.py
│       │   │   │   ├── transcribe.py
│       │   │   │   ├── analyze.py
│       │   │   │   └── report.py
│       │   │   └── states.py       # 状态机定义
│       │   ├── models/             # ── 数据模型 (SQLModel) ──
│       │   │   ├── base.py
│       │   │   ├── video.py
│       │   │   ├── task.py
│       │   │   ├── transcript.py
│       │   │   ├── analysis.py
│       │   │   ├── report.py
│       │   │   └── settings.py
│       │   ├── db/
│       │   │   ├── session.py      # SQLite engine
│       │   │   └── migrations/     # alembic
│       │   ├── prompts/            # ── Prompt 模板 (Jinja2) ──
│       │   │   ├── summary.j2
│       │   │   ├── keypoints.j2
│       │   │   ├── business.j2
│       │   │   ├── course.j2
│       │   │   └── viral.j2
│       │   └── utils/
│       │       ├── logging.py
│       │       ├── hashing.py
│       │       └── paths.py        # 数据目录解析
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/        # 真实跑 yt-dlp/whisper
│       │   └── fixtures/
│       ├── pyproject.toml          # 依赖管理 (uv/poetry)
│       ├── alembic.ini
│       └── README.md
│
├── packages/                       # 跨端共享（可选，如 OpenAPI 生成的 TS 类型）
│   └── api-types/                  # 由 server OpenAPI 自动生成
│
├── scripts/
│   ├── build_sidecar.sh            # PyInstaller 打包 Python 后端
│   ├── dev.sh                      # 一键起开发环境
│   └── release.sh                  # 全平台打包
│
├── .github/workflows/              # CI: lint / test / release
├── docker-compose.yml              # 开发用 Redis（生产桌面端内嵌）
├── Makefile                        # 常用命令封装
├── README.md
└── .gitignore
```

---

## 三、数据模型设计（SQLite）

核心实体关系：

```
Video 1──N Task        (一个视频可被多次分析)
Video 1──1 Transcript  (ASR 结果)
Task   1──1 Analysis   (AI 分析产物)
Task   1──N Report     (多格式报告)
Settings 全局单例
```

### 3.1 表结构（关键字段）

**videos**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | uuid |
| url | TEXT | 原始 URL |
| platform | TEXT | youtube/bilibili/douyin/... |
| title / author / cover_url | TEXT | 元数据 |
| duration_sec | INT | 时长 |
| published_at | DATETIME | 发布时间 |
| view_count | BIGINT | 播放量 |
| media_path | TEXT | 本地媒体文件路径 |
| created_at | DATETIME | 入库时间 |

**tasks**（任务 = 一次完整分析流水线）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| video_id | TEXT FK | |
| status | TEXT | queued/downloading/transcribing/analyzing/reporting/done/failed/paused |
| stage | TEXT | 当前细分步骤 |
| progress | INT | 0-100 |
| template | TEXT | summary/business/course/viral |
| options | JSON | 模型选择/RAG 开关等 |
| error | TEXT | 失败原因 |
| started_at / finished_at | DATETIME | |

**transcripts**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| video_id | TEXT FK | |
| asr_model | TEXT | tiny/base/... |
| language | TEXT | 检测语言 |
| segments_json | JSON | `[{start,end,text}]` |
| srt_path / vtt_path | TEXT | 字幕文件 |

**analyses** / **reports**：存 LLM 原始输出、最终渲染产物路径。

---

## 四、任务流水线与状态机

```
        ┌─────────┐
   ┌───▶│ queued  │
   │    └────┬────┘
   │         ▼
   │  ┌────────────┐
   │  │downloading │──── yt-dlp 采集 + 元数据
   │  └─────┬──────┘
   │        ▼
   │  ┌──────────────┐
   │  │transcribing  │──── FFmpeg 抽音频 → faster-whisper → SRT
   │  └─────┬────────┘
   │        ▼
   │  ┌────────────┐
   │  │ analyzing  │──── Prompt 模板 → LLM Router → 结构化结果
   │  └─────┬──────┘
   │        ▼
   │  ┌────────────┐
   │  │ reporting  │──── Markdown/PDF 渲染
   │  └─────┬──────┘
   │        ▼
   │  ┌────────────┐
   │  │   done     │
   │  └────────────┘
   │
   └─ 任意阶段失败 ──▶ failed（可 resume 从上次成功步骤继续）
```

**断点续传**：每个 task 持久化 `stage`，重试时跳过已完成步骤；yt-dlp 自带下载断点（`.part`）。

**并发**：Celery worker 配置 `--concurrency=3`（对应 PRD 3 并发）。

**进度上报**：步骤内部通过 Celery `update_state` + Redis pub/sub，WebSocket 实时推前端。

---

## 五、核心模块实现要点

### 5.1 视频采集（collector）
- 封装 `yt_dlp.YoutubeDL`，统一 options（格式选择 `bestaudio/best`、限速、限并发、Cookiefile）。
- `platforms.py` 维护各平台反爬策略表：UA、extractor args、headers。
- 抖音/快手：启用 `extractor_args` + 移动端 UA + 用户导入的 Cookie。
- 失败重试：网络类 3 次，鉴权类直接标错并提示导入 Cookie。

### 5.2 ASR（faster-whisper）
- `model_selector.py`：按时长 + GPU 可用性查表选模型（<5min→tiny，<30min→base，<2h→small，≥2h→medium，CPU 降一级）。
- 长视频切片：>30min 按 60s 窗 + 2s 重叠分片，结果按时间戳拼接。
- 输出：`segments=[{start,end,text}]`，导出 SRT/VTT。

### 5.3 AI 分析（analyzer）

> ⚠️ 本节为概览。AI 分析是三层结构，完整设计见 **[AI_ENGINE_DESIGN.md](./AI_ENGINE_DESIGN.md)**（V2 版，**模型服务商配置直接对齐本地 clawbox 项目**，极简不过度设计）。

- **模型服务商配置模块（Provider Settings）**：对齐 clawbox `ModelProvider`，6 字段 `{id, name, kind, base_url, api_key, default_model, enabled}`。设置页「🤖 模型服务商」子页做增删改（弹窗表单：类型/名称/API Key/Base URL/默认模型/启用）。**kind 只两类**：`openai_compat`（含 OpenAI/通义/DeepSeek/Ollama 等）和 `anthropic`（Claude）。
- **API Key 存储**：V1 明文存 `model_providers` 表（与 clawbox 一致）；`keyring`（macOS Keychain / Windows Credential Manager）留作 V2 安全增强，不阻塞主线。
- **模型选择（关键简化）**：模板只决定 Prompt，不绑模型。新建任务时用户选「服务商 + 模型」（默认填 `default_model`），不搞模板→模型映射表。容错简化为全局一个「备用服务商」。
- **Provider 抽象层**：统一 `LLMProvider` 接口；`openai_compat` 走 `openai` SDK（改 base_url），`anthropic` 走 `anthropic` SDK。
- **长文本**：`chunker.py` 按 token 预算切片 → map-reduce。
- **Prompt 模板**：Jinja2，每个模板定义 `system` + `user` + `output_schema`（JSON），`pydantic` 校验。
- **多模态 (V2)**：关键帧 OCR 文本并入 user prompt。

> 数据模型只需追加 `model_providers` 一张表（无需 routing_rules）；API 追加 `/settings/providers` CRUD —— 详见专题文档。

### 5.4 报告生成（reporter）
- Markdown：Jinja2 模板 + 分析 JSON。
- PDF：Markdown → HTML（markdown-it）→ weasyprint，支持自定义 Logo/CSS。
- PPTX (V2)：python-pptx 填预设模板占位符。
- **导出目录解析（`utils/paths.py`）**：`report_dir()` 优先读 `app_settings.report_dir`（用户自定义），否则 `~/Downloads`；`/reports/{id}/save` 支持 `?dir=` 临时指定（另存为），优先级：`dir` 参数 > 自定义 `report_dir` > `~/Downloads`。媒体目录 `media_dir()` 同理优先 `app_settings.media_dir`，否则 `data_dir/media`——所有采集/抽音频调用统一经此入口，自定义对全管线即时生效（无需重启）。

### 5.5 知识库 / RAG（V2）
- Chroma collection：每个 `transcript` 按 500 token 切块入库，元数据带 `video_id/platform/template`。
- 分析时勾选"参考历史"：retrieve Top-K → 注入 prompt 上下文。
- 问答端点：对库做语义检索 + LLM 合成答案，引用来源视频。

---

## 六、API 设计（REST + WS，前缀 `/api/v1`）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/tasks` | 创建分析任务（单 URL 或批量） |
| GET | `/tasks` `?status=&page=` | 任务列表 |
| GET | `/tasks/{id}` | 任务详情 + 进度 |
| POST | `/tasks/{id}/resume` | 恢复失败任务 |
| DELETE | `/tasks/{id}` | 取消/删除 |
| GET | `/videos` `?q=` | 视频库 |
| GET | `/videos/{id}` | 视频详情 + 元数据 |
| GET | `/transcripts/{video_id}` | 字幕（JSON/SRT/VTT） |
| GET | `/reports/{task_id}` | 报告内容 |
| POST | `/reports/{id}/export?fmt=md\|html\|pdf` | 导出（返回文件流） |
| POST | `/reports/{id}/save?fmt=&dir=` | 落盘到报告目录；`dir` 可选（另存为） |
| GET/PUT | `/settings/preferences` | 偏好（转录模型/语言、媒体目录、报告目录） |
| GET/PUT | `/settings/models` | 模型配置 |
| POST | `/settings/cookies` | 导入 Cookie |
| GET | `/system/paths` | 各存储目录实际生效路径（含自定义） |
| POST | `/knowledge/query` | RAG 问答 (V2) |
| GET | `/system/healthz` | 健康检查（sidecar 就绪探针） |
| WS | `/ws/tasks/{id}` | 任务进度实时推送 |

> 前端 TS 类型由 server 的 OpenAPI schema 自动生成（`packages/api-types`），保证前后端契约一致。

---

## 七、开发分阶段计划（V1.0 MVP）

| 阶段 | 周期 | 交付物 |
|------|------|--------|
| **P0 骨架** | 1 周 | Monorepo 结构；FastAPI healthz；Tauri 壳能拉起 sidecar；前端空壳跑通；docker-compose(Redis) |
| **P1 采集+ASR** | 2 周 | yt-dlp 多平台采集；FFmpeg 抽音频；faster-whisper；SRT/VTT；视频入库 |
| **P2 AI 分析** | 2 周 | 多模型 Router；4 套 Prompt 模板（摘要+商业+课程+爆款）；长文本切片 |
| **P3 报告+任务** | 1.5 周 | Markdown/PDF；任务状态机；断点续传；WebSocket 进度 |
| **P4 桌面集成** | 2 周 | Tauri 打包 sidecar；UI 全套页面；设置页（模型/Cookie/路径）；Windows+macOS 打包 |
| **P5 授权** | 0.5 周 | 单机激活码（本地校验 + 在线激活） |

**关键里程碑**：P1 结束可内部演示"URL→字幕"；P3 结束可演示完整"URL→PDF报告"；P4 结束出可分发安装包。

---

## 八、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 抖音/快手反爬升级 | 采集失败 | Cookie + UA 池；失败明确提示用户更新 Cookie；预留插件式 extractor |
| faster-whisper 长视频内存 | OOM | 强制分片 + 流式；模型自适应降级 |
| Tauri 打包 Python 体积大 | 安装包臃肿 | PyInstaller `--onefile` + UPX；按平台裁剪 |
| 平台 ToS / 版权 | 合规 | 默认只处理用户有权访问的内容；免责声明；不做内容分发 |
| 大模型 API 费用 | 成本 | 本地小模型优先做摘要；云端仅做深度分析；缓存重复请求 |

---

## 九、下一步行动

1. 确认本方案（技术栈 / 目录结构 / 阶段划分）。
2. 若通过，立即进入 **P0 骨架搭建**：
   - 初始化 `apps/server`（FastAPI + pyproject + healthz）
   - 初始化 `apps/desktop`（Tauri 2 + React + Vite）
   - `docker-compose.yml`、`Makefile`、`.gitignore`、`README.md`
