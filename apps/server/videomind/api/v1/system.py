"""系统接口（健康检查、版本）。"""
from pathlib import Path

from fastapi import APIRouter

from ... import __version__

router = APIRouter()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "service": "videomind", "version": __version__}


@router.get("/paths")
def paths() -> dict:
    from ...config import settings
    from ...utils.paths import media_dir, report_dir

    return {
        "data_dir": str(Path(settings.data_dir).expanduser()),
        "media_dir": str(media_dir()),
        "report_dir": str(report_dir()),
        "subtitles_dir": str(settings.subtitles_dir),
        "cookies_dir": str(settings.cookies_dir),
    }
