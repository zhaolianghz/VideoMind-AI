"""平台识别与反爬策略表。"""
import re
from urllib.parse import parse_qs, urlparse

# (平台名, 关联 host 片段)
PLATFORM_HOSTS: list[tuple[str, tuple[str, ...]]] = [
    ("youtube", ("youtube.com", "youtu.be", "youtube-nocookie.com")),
    ("bilibili", ("bilibili.com", "b23.tv")),
    ("douyin", ("douyin.com", "iesdouyin.com")),
    ("kuaishou", ("kuaishou.com", "gifshow.com", "chenzhongtech.com")),
    ("xiaohongshu", ("xiaohongshu.com", "xhslink.com")),
    ("tiktok", ("tiktok.com",)),
]

# 移动端 UA（抖音/快手等强反爬平台用）
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
)


def detect_platform(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    for name, hosts in PLATFORM_HOSTS:
        if any(h in host for h in hosts):
            return name
    return "unknown"


def canonicalize_url(url: str) -> str:
    """把平台的分享/弹窗形式链接重写成 yt-dlp 认识的标准形式。

    抖音的 modal_id 链接（如 /jingxuan?modal_id=xxx、/discover?modal_id=xxx）
    yt-dlp 提取器不识别，需重写为 /video/<id>。
    """
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if "douyin.com" in host:
        modal_id = parse_qs(parsed.query).get("modal_id", [""])[0]
        if re.fullmatch(r"\d+", modal_id):
            return f"https://www.douyin.com/video/{modal_id}"
    return url


def platform_opts(platform: str) -> dict:
    """各平台 yt-dlp 附加选项（反爬伪装）。"""
    if platform in ("douyin", "kuaishou"):
        return {"http_headers": {"User-Agent": MOBILE_UA}}
    return {}
