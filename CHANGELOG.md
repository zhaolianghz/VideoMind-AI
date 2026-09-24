# Changelog

All notable changes to **VideoMind AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-02-04

### Added
- **Import local video files** — pick local media via the native file dialog; thumbnails are extracted with ffmpeg, and deleting such a video never touches the user's original file.
- **Batch delete** in the video library.

### Fixed
- **Windows blank window on startup** — the sidecar's stdout/stderr now go to `<app data>/sidecar.log` (instead of being discarded), and a failed or crashed sidecar immediately reports its reason on the splash screen instead of silently waiting ~90s and then landing on an empty screen.
- Render errors no longer leave a black window: an error boundary + a boot-time error handler now show the actual error with a retry button.
- Splash polling aborted silently if `get_boot_stage` failed.

## [1.0.1] - 2026-07-26

### Added
- **Douyin creator collection** — collect a creator's recent videos from their homepage via an in-app webview (no signature reversing).
- **clawbox one-click import** — import AI provider configs from `~/.clawbox/config.json` (idempotent upsert by name, keeps local keys).
- **Default provider & model picker** — star a provider as default; the analyze panel preselects it and offers a model dropdown.
- **Custom storage directories** — media downloads and report exports are configurable in Settings; reports support "Save as…".
- **Auto pipeline** — opening the analyze panel on an untranscribed video auto-runs audio extraction → transcription; analysis unlocks when done.
- Settings → **About** section with app version and a **Check for updates** button (opens GitHub releases).

### Changed
- **Report view redesign** — editorial layout with numbered insight flow, six-color viz palette, score hero panel with gradient ring and animated bars.
- **New-task page redesign** — centered launcher layout with segmented control, hero input and iOS-style switches.
- **Splash redesign** — platform logos orbiting the owl with scan arc, staged boot captions and progress shimmer.
- ASR auto model selection is now quality-first (short videos use `small`; the old logic picked `tiny` and produced garbage Chinese).
- Video status / platform tags are localized (transcribed → 已转录 etc.).

### Fixed
- Sidecar process leak on app quit (RunEvent::Exit cleanup + parent-pid watchdog).
- Repackaging no longer triggers a needless ~30s re-extraction (content-hash fingerprint instead of mtime).
- Packaged transcription crash from missing `zhconv` data file.
- Export from video detail no longer navigates the webview into the raw file; failed/running analyses render properly with a retry entry.

## [0.1.0]

### Added
- First public open-source release under the MIT license.
- **Collect** — YouTube / Bilibili / Douyin / Kuaishou / Xiaohongshu / TikTok via `yt-dlp`, with batch mode and cookie import.
- **ASR** — local `faster-whisper` (GPU-accelerated, offline), auto model selection, SRT/VTT export.
- **AI analysis** — multi-provider routing (OpenAI / Claude / Qwen / DeepSeek / MiniMax / Ollama …), 5 analysis templates, map-reduce for long videos, reasoning-model aware.
- **Reports** — Markdown / PDF / HTML export.
- **Cross-platform desktop app** — Tauri 2 (Rust) + React, macOS / Windows.
- **i18n** — Chinese / English.
