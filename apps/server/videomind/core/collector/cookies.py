"""Cookie 文件管理（用户导入的浏览器 Cookie）。"""
from pathlib import Path

from ...utils.paths import cookies_dir


def cookiefile_for(platform: str) -> Path:
    return cookies_dir() / f"{platform}.txt"


def resolve_cookiefile(platform: str) -> Path | None:
    f = cookiefile_for(platform)
    return f if f.exists() else None
