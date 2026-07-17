"""FastAPI 应用入口。"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api.v1 import api_router
from .config import settings
from .db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from .services.recovery import recover_interrupted_tasks

    recovered = recover_interrupted_tasks()
    if recovered["videos"] or recovered["analyses"]:
        print(f"[videomind] 恢复中断任务: {recovered}")
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="VideoMind AI",
        version=__version__,
        description="AI Video Intelligence OS - backend",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()


def run() -> None:
    """供 `videomind` 命令调用。"""
    import uvicorn

    uvicorn.run(
        "videomind.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )
