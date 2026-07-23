# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VideoMind AI is an "AI Video Intelligence OS" — a cross-platform desktop app that turns any video into structured insight (collection → ASR → AI analysis → report generation). Licensed MIT.

## Architecture

Monorepo with two apps under `apps/`:

### Backend — `apps/server/` (Python + FastAPI)
- Python package `videomind`; entry `videomind.main:app`.
- Runs the full pipeline: video collection / ASR / AI analysis / report generation.
- Listens on `127.0.0.1:18791`. Health check: `GET /api/v1/system/healthz`. Interactive API docs: `/docs`.
- Shipped inside the desktop app as a bundled **sidecar** (see `scripts/build_sidecar.sh`, `apps/server/videomind_sidecar.spec` — PyInstaller).
- Config via env vars prefixed `VIDEOMIND_` or an `.env` file. Data dir defaults to `~/.videomind` (SQLite at `$DATA_DIR/videomind.db`).
- Tooling: Ruff, target `py311`.

### Desktop shell — `apps/desktop/` (Tauri v2)
- `src-tauri/` — Rust Tauri host. `productName` "VideoMind AI", identifier `com.videomind.desktop`. Starts the Python sidecar and exposes a `get_api_base` command the frontend invokes to discover the live sidecar API base URL.
- `web/` — the React frontend (`videomind-web`).

### Frontend — `apps/desktop/web/` (React 18 + TS + Vite 5 + Tailwind 3)
- Entry: `src/main.tsx` → `src/App.tsx`. State via `zustand`, HTTP via `axios`.
- Routing (`react-router-dom`) in `App.tsx`:
  - `/` Dashboard · `/tasks/new` NewTask · `/library` Library · `/videos/:id` VideoDetail · `/reports` Reports · `/reports/:id` ReportDetail · `/data` DataTable · `/providers` Providers · `/settings` Settings
- `src/api/` — axios client (`client.ts`) + per-domain modules: `analyses`, `cookies`, `creators`, `preferences`, `providers`, `system`, `transcripts`, `videos`. The API base URL is set at runtime: production (Tauri) from `invoke('get_api_base')`; dev (browser) falls back to the Vite proxy at `/api/v1`.
- `src/components/` — `Sidebar`, `LanguageSwitcher`, `ReportView`.
- `src/pages/` — one file per route above.
- **Startup flow**: `App.tsx` polls `get_api_base` for up to 90s while the sidecar boots; on a non-Tauri (browser) environment the invoke rejects and it falls through to the Vite proxy.

## Commands

The root `Makefile` holds the canonical dev commands:

```bash
make install   # server: pip install -e ".[dev]"  +  web: npm install
make server    # uvicorn videomind.main:app --reload --host 127.0.0.1 --port 18791
make web       # Vite dev server → http://localhost:1420
make tauri     # Tauri desktop shell (auto-runs `make web` via beforeDevCommand)
make build     # ./scripts/build_sidecar.sh  then  cd apps/desktop && npm run build (tauri build)
make lint      # ruff check (server) + web build check
```

Frontend-only build: `cd apps/desktop/web && npm run build` (`tsc -b && vite build`).

Two ways to run in dev: two terminals (`make server` + `make web`), or `make tauri` for the full desktop app.

## Ports

- Sidecar / API: `18791`
- Vite dev server: `1420`

## i18n

User-facing strings go through the i18n layer in `apps/desktop/web/src/i18n/` (`I18nProvider` + `LanguageSwitcher`). Locales are **TypeScript** files — `en.ts` and `zh.ts` — not JSON. Keep both in sync when adding keys.

## Key Files

- `apps/server/videomind/main.py` — FastAPI app entry
- `apps/desktop/web/src/App.tsx` — root component, routing, sidecar readiness gating
- `apps/desktop/web/src/api/client.ts` — axios instance (runtime base URL)
- `apps/desktop/src-tauri/tauri.conf.json` — Tauri config (`get_api_base`, sidecar wiring, bundle)
- `scripts/build_sidecar.sh` — packages the Python backend into the desktop bundle
- `Makefile` — dev/build entry points
