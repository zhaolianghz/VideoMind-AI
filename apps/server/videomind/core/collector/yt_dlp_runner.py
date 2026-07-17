"""yt-dlp 封装：元数据抓取 + 音频下载。"""
from datetime import datetime
from pathlib import Path

import yt_dlp

from .cookies import resolve_cookiefile
from .platforms import canonicalize_url, detect_platform, platform_opts


def _base_opts(outdir: Path, cookiefile: Path | None) -> dict:
    opts: dict = {
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
        "fragment_retries": 3,
        "outtmpl": str(outdir / "%(id)s.%(ext)s"),
    }
    if cookiefile:
        opts["cookiefile"] = str(cookiefile)
    return opts


def fetch_metadata(url: str, outdir: Path) -> dict:
    """仅抓元数据，不下载。"""
    url = canonicalize_url(url)
    platform = detect_platform(url)
    opts = _base_opts(outdir, resolve_cookiefile(platform))
    opts.update(platform_opts(platform))
    opts["skip_download"] = True
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return _normalize(info, platform)


def download_audio(url: str, outdir: Path) -> tuple[dict, str]:
    """下载最佳音频，返回 (元数据, 本地文件路径)。"""
    url = canonicalize_url(url)
    platform = detect_platform(url)
    opts = _base_opts(outdir, resolve_cookiefile(platform))
    opts.update(platform_opts(platform))
    opts["format"] = "bestaudio/best"
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
    return _normalize(info, platform), filename


def _normalize(info: dict, platform: str) -> dict:
    pub = None
    ud = info.get("upload_date") or ""  # YYYYMMDD
    if len(ud) == 8:
        try:
            pub = datetime.strptime(ud, "%Y%m%d")
        except ValueError:
            pub = None
    if platform == "unknown":
        platform = (info.get("extractor_key") or "").lower() or "unknown"
    return {
        "platform": platform,
        "title": info.get("title", "") or "",
        "author": info.get("uploader") or info.get("channel") or "",
        "cover_url": info.get("thumbnail", "") or "",
        "duration_sec": int(info.get("duration") or 0),
        "published_at": pub,
        "view_count": int(info.get("view_count") or 0),
        "source_id": str(info.get("id", "")),
    }
