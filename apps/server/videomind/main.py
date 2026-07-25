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


def _import_ee():
    """独立函数便于测试注入。返回 EE 模块或 None。"""
    try:
        import videomind_ee

        return videomind_ee
    except ImportError:
        return None


def _load_ee(app: FastAPI) -> None:
    """加载商业版扩展：无 EE 包静默跳过；EE 崩溃不影响 CE。"""
    ee = _import_ee()
    if ee is None:
        return
    try:
        ee.register(app)
        print("[videomind] EE 扩展已加载")
    except Exception as e:  # noqa: BLE001 - EE 任何异常都不能拖垮 CE
        print(f"[videomind] EE 扩展加载失败（已忽略）: {e}")


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
    _load_ee(app)
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
