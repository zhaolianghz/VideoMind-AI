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

# 分享短链 host：需要先跟随重定向拿到真实链接，yt-dlp 提取器才认识
SHORT_LINK_HOSTS: tuple[str, ...] = (
    "v.douyin.com",
    "v.kuaishou.com",
    "b23.tv",
    "xhslink.com",
)

# 分享口令里的 URL（在空白或中文/中文标点处截断，兼容“链接后紧跟中文”的口令格式）
_URL_RE = re.compile(r"https?://[^\s一-鿿，。；：、“”‘’《》【】()（）<>]+")

# 移动端 UA（抖音/快手等强反爬平台用）
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
)


def extract_share_url(text: str) -> str:
    """从分享口令文本中抽出 URL。

    抖音/快手/小红书的“复制链接”是一段口令：
    「2.38 复制打开抖音，看看【xx的作品】… https://v.douyin.com/xxx/ r@R.kC …」
    用户整段粘贴时，取其中第一个 URL；没有 URL 则原样返回（交给后续报错）。
    """
    m = _URL_RE.search(text)
    return m.group(0).rstrip(".,;!?'\"") if m else text.strip()


def detect_platform(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    for name, hosts in PLATFORM_HOSTS:
        if any(h in host for h in hosts):
            return name
    return "unknown"


def resolve_short_url(url: str, timeout: float = 15.0) -> str:
    """把分享短链（v.douyin.com 等）跟随重定向解析为真实链接。

    非短链原样返回；解析失败也原样返回（由 yt-dlp 报出更具体的错误）。
    含网络请求，只在后台采集任务里调用，不要阻塞 API。
    """
    host = (urlparse(url).hostname or "").lower()
    if not any(host == h or host.endswith("." + h) for h in SHORT_LINK_HOSTS):
        return url
    try:
        import httpx

        resp = httpx.get(
            url,
            headers={"User-Agent": MOBILE_UA},
            follow_redirects=True,
            timeout=timeout,
        )
        return canonicalize_url(str(resp.url))
    except Exception:
        return url


def canonicalize_url(url: str) -> str:
    """把平台的分享/弹窗形式链接重写成 yt-dlp 认识的标准形式。

    同时做同视频归一（用于去重）：
    - 抖音 modal_id 链接（/jingxuan?modal_id=xxx）→ /video/<id>
    - 抖音短链重定向落点 www.iesdouyin.com/share/video/<id>/ → www.douyin.com/video/<id>
    - 抖音主页分享落点 /share/user/<sec_uid> → www.douyin.com/user/<sec_uid>
    - YouTube youtu.be/<id>、/shorts/<id>、watch?v=<id>&si=… → watch?v=<id>（去跟踪参数）
    """
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if "douyin.com" in host:
        modal_id = parse_qs(parsed.query).get("modal_id", [""])[0]
        if re.fullmatch(r"\d+", modal_id):
            return f"https://www.douyin.com/video/{modal_id}"
        m = re.search(r"/share/(?:video|slides)/(\d+)", parsed.path)
        if m:
            return f"https://www.douyin.com/video/{m.group(1)}"
        m = re.search(r"/share/user/([\w.-]+)", parsed.path)
        if m:
            return f"https://www.douyin.com/user/{m.group(1)}"
        m = re.search(r"/video/(\d+)", parsed.path)
        if m:
            return f"https://www.douyin.com/video/{m.group(1)}"
    if host == "youtu.be":
        vid = parsed.path.strip("/").split("/")[0]
        if vid:
            return f"https://www.youtube.com/watch?v={vid}"
    if host.endswith("youtube.com"):
        m = re.search(r"/(?:shorts|live|embed)/([\w-]{6,})", parsed.path)
        if m:
            return f"https://www.youtube.com/watch?v={m.group(1)}"
        if parsed.path == "/watch":
            vid = parse_qs(parsed.query).get("v", [""])[0]
            if vid:
                return f"https://www.youtube.com/watch?v={vid}"
    return url


def is_douyin_user_url(url: str) -> bool:
    """是否是抖音博主主页链接。

    yt-dlp 的抖音提取器只认 `/video/<id>`，不实现用户页；且旧版
    `web/api/v2/aweme/post` 接口已失效（200/0 字节）。博主主页需走 webview
    方案，调用方应据此给出明确提示，而非让 yt-dlp 报误导性的 "Unsupported URL"。
    匹配 canonicalize 后的 `/user/<sec_uid>`，也兼容未归一的 `/share/user/`。
    """
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if "douyin.com" not in host and "iesdouyin.com" not in host:
        return False
    return bool(re.search(r"/(?:share/)?user/[\w.-]+", parsed.path))


def platform_opts(platform: str) -> dict:
    """各平台 yt-dlp 附加选项（反爬伪装）。"""
    if platform in ("douyin", "kuaishou"):
        return {"http_headers": {"User-Agent": MOBILE_UA}}
    return {}
