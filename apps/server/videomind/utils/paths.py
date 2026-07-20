"""数据目录解析。"""
from pathlib import Path

from ..config import settings


def media_dir() -> Path:
    return settings.media_dir


def subtitles_dir() -> Path:
    return settings.subtitles_dir


def covers_dir() -> Path:
    return settings.covers_dir


def cookies_dir() -> Path:
    return settings.cookies_dir
