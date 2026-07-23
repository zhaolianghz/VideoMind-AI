.PHONY: help install server web tauri dev build lint

help:
	@echo "VideoMind AI - dev commands"
	@echo "  make install  - install backend + frontend deps"
	@echo "  make server   - run FastAPI backend (127.0.0.1:18791)"
	@echo "  make web      - run Vite dev server (localhost:1420)"
	@echo "  make tauri    - run Tauri desktop shell"
	@echo "  make build    - build frontend + desktop bundle"

install:
	cd apps/server && pip install -e ".[all]"
	cd apps/desktop/web && npm install

server:
	cd apps/server && uvicorn videomind.main:app --reload --host 127.0.0.1 --port 18791

web:
	cd apps/desktop/web && npm run dev

tauri:
	cd apps/desktop && npm run dev

dev:
	@echo "👉 Open two terminals: 'make server' and 'make web'"
	@echo "👉 Or run 'make tauri' to launch desktop (auto-starts web)"

build:
	./scripts/build_sidecar.sh
	cd apps/desktop && npm run build

lint:
	cd apps/server && ruff check . || true
	cd apps/desktop/web && npm run build -- --mode=check || true
