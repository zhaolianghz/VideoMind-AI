"""数据目录解析。

自定义路径（app_settings 持久化）优先，否则用默认值。
用户可在「设置」里覆盖媒体目录（下载的音视频）和报告导出目录。
封面 / 字幕 / cookie 属于应用内部数据，跟随 data_dir，不开放自定义。
"""
from pathlib import Path

from ..config import settings

# 允许用户在「设置」里覆盖的存储键（值存在 app_settings 表）
MEDIA_DIR_KEY = "media_dir"
REPORT_DIR_KEY = "report_dir"


def _setting(key: str) -> str:
    """惰性查 app_settings（避开启动期 import 环）。空串 = 未自定义。"""
    try:
        from sqlmodel import Session

        from ..db.session import engine
        from ..models.setting import AppSetting

        with Session(engine) as s:
            row = s.get(AppSetting, key)
            return (row.value if row else "").strip()
    except Exception:
        return ""


def _ensure(p: Path) -> Path:
    p.mkdir(parents=True, exist_ok=True)
    return p


def media_dir() -> Path:
    """媒体目录（下载的音视频，占空间）：自定义优先，否则 data_dir/media。"""
    custom = _setting(MEDIA_DIR_KEY)
    if custom:
        return _ensure(Path(custom).expanduser())
    return settings.media_dir  # config 已自带 mkdir


def report_dir() -> Path:
    """报告导出目录：自定义优先，否则 ~/Downloads。"""
    custom = _setting(REPORT_DIR_KEY)
    if custom:
        return _ensure(Path(custom).expanduser())
    return _ensure(Path.home() / "Downloads")


def subtitles_dir() -> Path:
    return settings.subtitles_dir


def covers_dir() -> Path:
    return settings.covers_dir


def cookies_dir() -> Path:
    return settings.cookies_dir
