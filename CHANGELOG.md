# Changelog

All notable changes to **VideoMind AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Settings → **About** section with app version and a **Check for updates** button (opens GitHub releases).

## [0.1.0]

### Added
- First public open-source release under the MIT license.
- **Collect** — YouTube / Bilibili / Douyin / Kuaishou / Xiaohongshu / TikTok via `yt-dlp`, with batch mode and cookie import.
- **ASR** — local `faster-whisper` (GPU-accelerated, offline), auto model selection, SRT/VTT export.
- **AI analysis** — multi-provider routing (OpenAI / Claude / Qwen / DeepSeek / MiniMax / Ollama …), 5 analysis templates, map-reduce for long videos, reasoning-model aware.
- **Reports** — Markdown / PDF / HTML export.
- **Cross-platform desktop app** — Tauri 2 (Rust) + React, macOS / Windows.
- **i18n** — Chinese / English.
