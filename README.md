<div align="center">

# VideoMind AI

**AI Video Intelligence OS — Turn any video into structured insight.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/lxw15337674/VideoMind-AI/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org)
[![Tauri](https://img.shields.io/badge/Tauri-2-orange.svg)](https://tauri.app)

An open-source desktop agent that **collects** videos from major platforms, **transcribes** them locally, runs **deep AI analysis**, and produces **structured reports** — your AI video researcher.

[Features](#-features) · [Quick Start](#-quick-start) · [Build App](#-build-the-desktop-app) · [Roadmap](#-roadmap) · [Docs](#-docs)

</div>

---

## ✨ Features

- 🎬 **Collect** — YouTube / Bilibili / Douyin / Kuaishou / Xiaohongshu / TikTok via `yt-dlp`, with batch mode + cookie import
- 🎙️ **ASR** — local `faster-whisper` (GPU-accelerated, offline), auto model selection, SRT/VTT export
- 🧠 **AI analysis** — multi-provider routing (OpenAI / Claude / Qwen / DeepSeek / MiniMax / Ollama …), 5 analysis templates (**summary / keypoints / business model / course breakdown / viral pattern**), map-reduce for long videos, reasoning-model aware (`<think>` blocks)
- 📄 **Reports** — Markdown / PDF / HTML export with structured rendering
- 🖥️ **Cross-platform desktop app** — Tauri 2 (Rust) + React, macOS / Windows
- 🔒 **Local-first** — media, transcripts and API keys stay on your machine

## 🧩 How it works

```
URL → yt-dlp collect → ffmpeg → wav → faster-whisper transcript
    → multi-model AI analysis → structured JSON → MD / PDF report
```

All running inside one desktop app — a Python backend (FastAPI) spawned as a sidecar, wrapped by a Tauri shell.

## 🚀 Quick Start (development)

```bash
# 1. Backend (Python 3.11+)
cd apps/server
pip install -e ".[dev]"
uvicorn videomind.main:app --reload --port 18791

# 2. Frontend (Node 20+) — another terminal
cd apps/desktop/web
npm install
npm run dev    # → http://localhost:1420
```

Open <http://localhost:1420> → **Providers** page add a model (e.g. an OpenAI-compatible endpoint) → **New Task** paste a video URL → collect → transcribe → analyze → export PDF.

> Requires **FFmpeg** installed on your system (invoked as subprocess; not bundled).

## 📦 Build the desktop app

```bash
# Pack the Python backend as a sidecar (includes whisper/weasyprint natives)
./scripts/build_sidecar.sh

# Build the Tauri bundle (.app / .dmg on macOS, .msi on Windows)
cd apps/desktop && npm run build
```

See [apps/desktop/README.md](apps/desktop/README.md) for sidecar / signing details.

## ⚙️ Configuration

| What | Where |
|------|-------|
| Model providers | In-app **Providers** page (OpenAI-compatible + Anthropic; 30+ presets) |
| Platform cookies (member videos) | In-app **Settings → Cookie import** |
| Data directory | `~/.videomind` (override via `VIDEOMIND_DATA_DIR`) |

## 🗺️ Roadmap — Open Core

| Capability | CE (this repo, MIT) | EE (commercial) |
|------------|:---:|:---:|
| Core pipeline (collect / ASR / analyze / report / desktop) | ✅ | ✅ |
| Result viewer (player + transcript + report split view) | ✅ | ✅ |
| i18n (zh / en) | ✅ | ✅ |
| **Knowledge base (RAG + semantic Q&A)** | — | 🔒 |
| **PPT / mindmap export** | — | 🔒 |
| **Multimodal OCR (keyframes)** | — | 🔒 |
| **Account monitoring agent (competitor weekly report)** | — | 🔒 |
| **Team / private deploy / open API** | — | 🔒 |

Core stays free forever. Enterprise capabilities fund development.
See [docs/OPEN_CORE_STRATEGY.md](docs/OPEN_CORE_STRATEGY.md).

## 📚 Docs

- [PRD (产品需求)](docs/PRD.md)
- [Tech Design](docs/TECH_DESIGN.md)
- [AI Engine Design](docs/AI_ENGINE_DESIGN.md)
- [UI Redesign Plan](docs/UI_REDESIGN_PLAN.md)
- [V4 Account Monitor Plan](docs/V4_ACCOUNT_MONITOR_PLAN.md)

## 🤝 Contributing

Contributions to the **core** are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

> Enterprise features (RAG / PPT / OCR / account monitoring / team) are developed in a private commercial edition and are **out of scope** for PRs to this repository.

## 🔐 Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately, not via public issues.

## 📄 License

[MIT](LICENSE) © VideoMind AI.

**Third-party notices:** depends on [yt-dlp](https://github.com/yt-dlp/yt-dlp), [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [FFmpeg](https://ffmpeg.org) (LGPL/GPL, invoked as subprocess, not bundled), [Tauri](https://tauri.app), [React](https://react.dev), and model providers you configure.
