"""yt-dlp 封装：元数据抓取 + 音频下载。"""
import shutil
from collections.abc import Callable
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import yt_dlp

from .cookies import resolve_cookiefile
from .platforms import (
    canonicalize_url,
    detect_platform,
    is_douyin_user_url,
    platform_opts,
    resolve_short_url,
)


class UnsupportedChannelURL(Exception):
    """博主主页/频道 URL 当前不支持（如抖音主页：yt-dlp 未实现，需 webview）。"""


def _douyin_user_hint() -> str:
    return (
        "抖音博主主页暂不支持批量采集：yt-dlp 未实现抖音用户页，"
        "旧版 web/api/v2/aweme/post 接口也已失效。"
        "请改粘单条视频链接（https://www.douyin.com/video/<id>）或 App 分享口令。"
    )


@lru_cache(maxsize=1)
def _js_runtimes() -> dict:
    """探测本机 JS 运行时（node/deno/bun），供 yt-dlp 解 YouTube n challenge。

    没有 JS 运行时时 YouTube 只能拿到 storyboard 图片（下载必失败）。
    GUI 应用（Tauri sidecar）的 PATH 很干净，所以除 PATH 外还扫常见安装位置。
    """
    home = Path.home()
    candidates: dict[str, list[Path]] = {
        "node": [
            *sorted((home / ".nvm/versions/node").glob("*/bin/node"), reverse=True),
            Path("/opt/homebrew/bin/node"),
            Path("/usr/local/bin/node"),
            Path("/usr/bin/node"),
        ],
        "deno": [
            home / ".deno/bin/deno",
            Path("/opt/homebrew/bin/deno"),
            Path("/usr/local/bin/deno"),
        ],
        "bun": [
            home / ".bun/bin/bun",
            Path("/opt/homebrew/bin/bun"),
            Path("/usr/local/bin/bun"),
        ],
    }
    found: dict[str, dict] = {}
    for name, paths in candidates.items():
        on_path = shutil.which(name)
        if on_path:
            found[name] = {"path": on_path}
            continue
        for p in paths:
            if p.is_file():
                found[name] = {"path": str(p)}
                break
    return found


def _base_opts(outdir: Path, cookiefile: Path | None) -> dict:
    opts: dict = {
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
        "fragment_retries": 3,
        "outtmpl": str(outdir / "%(id)s.%(ext)s"),
    }
    runtimes = _js_runtimes()
    if runtimes:
        opts["js_runtimes"] = runtimes
    if cookiefile:
        opts["cookiefile"] = str(cookiefile)
    return opts


def fetch_metadata(url: str, outdir: Path) -> dict:
    """仅抓元数据，不下载。"""
    url = canonicalize_url(resolve_short_url(url))
    if is_douyin_user_url(url):
        raise UnsupportedChannelURL(_douyin_user_hint())
    platform = detect_platform(url)
    opts = _base_opts(outdir, resolve_cookiefile(platform))
    opts.update(platform_opts(platform))
    opts["skip_download"] = True
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return _normalize(info, platform)


def fetch_channel_videos(channel_url: str, limit: int = 20) -> list[dict]:
    """拉取频道/博主主页的视频列表（不下载），返回 [{url, title, source_id}]。

    extract_flat 只取列表页条目，不逐条解析视频详情，速度快；
    详细元数据由后续逐条 run_collect 补齐。
    """
    channel_url = canonicalize_url(resolve_short_url(channel_url))
    if is_douyin_user_url(channel_url):
        raise UnsupportedChannelURL(_douyin_user_hint())
    platform = detect_platform(channel_url)
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "playlistend": max(1, min(limit, 100)),  # 防误传超大 limit
        "retries": 3,
    }
    if _js_runtimes():
        opts["js_runtimes"] = _js_runtimes()
    cookiefile = resolve_cookiefile(platform)
    if cookiefile:
        opts["cookiefile"] = str(cookiefile)
    opts.update(platform_opts(platform))
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(channel_url, download=False)

    entries = info.get("entries") or []
    out: list[dict] = []
    for e in entries:
        if not e:
            continue
        # YouTube 频道主页返回 tab 嵌套（Videos/Shorts…），取第一层 Videos tab
        if e.get("_type") == "playlist" and e.get("entries"):
            for sub in e["entries"]:
                if sub and sub.get("url"):
                    out.append(_flat_entry(sub))
            break
        if e.get("url") or e.get("id"):
            out.append(_flat_entry(e))
    return out[: max(1, min(limit, 100))]


def _flat_entry(e: dict) -> dict:
    return {
        "url": e.get("url") or e.get("webpage_url") or "",
        "title": e.get("title", "") or "",
        "source_id": str(e.get("id", "")),
    }


def fetch_comments(url: str, limit: int = 100) -> list[dict]:
    """抓取视频评论（YouTube 按热度优先）。

    返回 [{author, text, like_count}]。平台不支持评论抓取时返回空列表，
    由 API 层转成友好提示。
    """
    url = canonicalize_url(resolve_short_url(url))
    platform = detect_platform(url)
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "getcomments": True,
        "extractor_args": {
            "youtube": {"max_comments": [str(limit)], "comment_sort": ["top"]}
        },
    }
    if _js_runtimes():
        opts["js_runtimes"] = _js_runtimes()
    cookiefile = resolve_cookiefile(platform)
    if cookiefile:
        opts["cookiefile"] = str(cookiefile)
    opts.update(platform_opts(platform))
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    out: list[dict] = []
    for c in (info.get("comments") or [])[: limit * 2]:
        text = (c.get("text") or "").strip()
        if not text:
            continue
        out.append({
            "author": str(c.get("author") or ""),
            "text": text[:500],
            "like_count": int(c.get("like_count") or 0),
        })
        if len(out) >= limit:
            break
    return out


def download_audio(
    url: str,
    outdir: Path,
    on_progress: Callable[[int], None] | None = None,
) -> tuple[dict, str]:
    """下载最佳音频，返回 (元数据, 本地文件路径)。

    on_progress: 收到 0-100 的下载进度百分比（yt-dlp progress hook）。
    """
    url = canonicalize_url(resolve_short_url(url))
    if is_douyin_user_url(url):
        raise UnsupportedChannelURL(_douyin_user_hint())
    platform = detect_platform(url)
    opts = _base_opts(outdir, resolve_cookiefile(platform))
    opts.update(platform_opts(platform))
    opts["format"] = "bestaudio/best"
    if on_progress:

        def hook(d: dict) -> None:
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            got = d.get("downloaded_bytes") or 0
            if d.get("status") == "downloading" and total:
                on_progress(min(99, int(got * 100 / total)))
            elif d.get("status") == "finished":
                on_progress(100)

        opts["progress_hooks"] = [hook]
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
    return _normalize(info, platform), filename


def _https(url: str) -> str:
    """http → https。B站/小红书封面是 http://，在 webview 安全上下文中
    会被当作混合内容拦截导致不显示；这些 CDN 均支持 https。"""
    if url.startswith("http://"):
        return "https://" + url[7:]
    return url


def download_cover(cover_url: str, outdir: Path, name: str) -> str:
    """下载封面到本地，返回文件路径；失败返回空串（封面非关键，不抛错）。

    小红书封面 URL 带时效签名会过期，抖音签名也有有效期，
    所以采集时就落盘，和音频一个待遇。
    """
    if not cover_url:
        return ""
    try:
        import httpx

        resp = httpx.get(
            _https(cover_url),
            headers={"User-Agent": "Mozilla/5.0"},
            follow_redirects=True,
            timeout=15,
        )
        resp.raise_for_status()
        ctype = resp.headers.get("content-type", "")
        ext = {"image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}.get(
            ctype.split(";")[0].strip(), ".jpg"
        )
        outdir.mkdir(parents=True, exist_ok=True)
        dst = outdir / f"{name}{ext}"
        dst.write_bytes(resp.content)
        return str(dst)
    except Exception:
        return ""


def friendly_error(e: Exception) -> str:
    """把 yt-dlp 采集错误转成带解决指引的中文提示。"""
    if isinstance(e, UnsupportedChannelURL):
        return str(e)
    msg = str(e)
    low = msg.lower()
    if any(
        k in low
        for k in (
            "fresh cookies",
            "sign in to confirm",
            "login required",
            "--cookies",
            "requested content is not available",
            "logged-in",
        )
    ):
        return (
            "平台风控，需要浏览器 Cookie：请到 设置 → 平台 Cookie，"
            "选择该平台点「导入」从浏览器一键读取（无需登录导出工具），"
            f"然后重新采集。原始错误：{msg[:200]}"
        )
    if "unsupported url" in low:
        return f"暂不支持该链接格式，请粘贴视频页链接或 App 分享口令。原始错误：{msg[:200]}"
    if "requested format is not available" in low:
        if not _js_runtimes():
            return (
                "无法解析视频流：本机缺少 JavaScript 运行时（YouTube 反爬需要）。"
                "请安装 Node.js（brew install node）后重新采集。"
                f"原始错误：{msg[:150]}"
            )
        return (
            "无法解析视频流（平台风控或视频受限）。可尝试：重新采集、"
            f"到 设置 → 平台 Cookie 重新导入后重试。原始错误：{msg[:150]}"
        )
    if "video unavailable" in low or "private" in low:
        return f"视频不可用（已删除/私密/地区限制）。原始错误：{msg[:200]}"
    return msg


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
    author = info.get("uploader") or info.get("channel") or ""
    return {
        "platform": platform,
        "title": info.get("title", "") or "",
        "author": author,
        # 稳定的创作者标识：优先 channel_id（YouTube 改名不变），
        # 其次 uploader_id（B站 uid / 抖音 sec_uid），最后退化为显示名
        "author_id": str(
            info.get("channel_id") or info.get("uploader_id") or author or ""
        ),
        "channel_url": info.get("channel_url") or info.get("uploader_url") or "",
        "cover_url": _https(info.get("thumbnail", "") or ""),
        "duration_sec": int(info.get("duration") or 0),
        "published_at": pub,
        "view_count": int(info.get("view_count") or 0),
        # 互动数据（yt-dlp 各平台提取器提供；缺失记 0）
        "like_count": int(info.get("like_count") or 0),
        "comment_count": int(info.get("comment_count") or 0),
        "share_count": int(info.get("repost_count") or 0),
        "favorite_count": int(info.get("favorite_count") or 0),
        "music": str(info.get("track") or ""),
        "source_id": str(info.get("id", "")),
        # 平台原生分类/标签（YouTube 有官方 categories；B站/抖音多为 tags）。
        # 作为冷启动粗分类，后续 LLM classify 会覆盖 category
        "category": (info.get("categories") or [""])[0] or "",
        "tags": [str(t) for t in (info.get("tags") or [])[:10]],
    }
