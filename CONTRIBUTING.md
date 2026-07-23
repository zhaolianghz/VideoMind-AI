# Contributing to VideoMind AI

Thanks for your interest in contributing! 🎉

## Development Setup

```bash
# Backend (Python 3.11+)
cd apps/server
pip install -e ".[all]"   # dev + llm + asr + report
uvicorn videomind.main:app --reload --port 18791

# Frontend (Node 20+)
cd apps/desktop/web
npm install
npm run dev    # http://localhost:1420

# Desktop shell (optional)
cd apps/desktop && npm run dev   # Tauri
```

See [docs/TECH_DESIGN.md](docs/TECH_DESIGN.md) for architecture.

## Project Structure

```
apps/
├── server/      Python FastAPI backend (collect / ASR / analyze / report)
└── desktop/     Tauri (Rust) + React + Vite frontend
docs/            PRD, tech design, plans
scripts/         build / dev helpers
```

## Before You Submit

- `cd apps/server && ruff check . && pytest tests/`
- `cd apps/desktop/web && npm run build`
- One logical change per PR
- Follow existing code style (ruff + prettier defaults)

## Scope

**Core** (this repo, MIT): collect → ASR → AI analysis → MD/PDF report → desktop app.

Enterprise features (knowledge base RAG, PPT, account monitoring, team/private/API) live in the commercial edition and are **out of scope** for this repo. Feature requests for enterprise capabilities are welcome but won't be implemented here — see [docs/OPEN_CORE_STRATEGY.md](docs/OPEN_CORE_STRATEGY.md).

## Commit & PR

- Conventional commits preferred (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- Descriptive PR title + link the issue
- Be kind. Review the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
