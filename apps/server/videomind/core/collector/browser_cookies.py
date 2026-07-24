"""从本地浏览器直接提取 Cookie（免手动导出）。

复用 yt-dlp 的浏览器 Cookie 解密能力（Chrome/Edge/Firefox/Safari…），
按平台域名过滤后落盘为标准 Netscape cookiefile，后续采集链路不变。
yt_dlp 延迟加载（import 约 120ms），不进 sidecar 启动关键路径。
"""
from pathlib import Path

# 前端展示顺序（常用优先）；safari 需要完全磁盘访问权限，放最后
BROWSER_LABELS: dict[str, str] = {
    "chrome": "Chrome",
    "edge": "Edge",
    "brave": "Brave",
    "firefox": "Firefox",
    "chromium": "Chromium",
    "vivaldi": "Vivaldi",
    "opera": "Opera",
    "whale": "Whale",
    "safari": "Safari",
}

# 各平台鉴权 Cookie 所在域。
# 注意 YouTube 登录态依赖 .google.com 域下的 SID/SAPISID 等，必须一并带上
PLATFORM_DOMAINS: dict[str, tuple[str, ...]] = {
    "youtube": ("youtube.com", "google.com"),
    "bilibili": ("bilibili.com",),
    "douyin": ("douyin.com",),
    "kuaishou": ("kuaishou.com",),
    "xiaohongshu": ("xiaohongshu.com",),
    "tiktok": ("tiktok.com",),
}


def supported_browsers() -> list[dict]:
    from yt_dlp.cookies import SUPPORTED_BROWSERS

    return [
        {"name": name, "label": label}
        for name, label in BROWSER_LABELS.items()
        if name in SUPPORTED_BROWSERS
    ]


def _match(domain: str, wanted: tuple[str, ...]) -> bool:
    d = domain.lstrip(".")
    return any(d == w or d.endswith("." + w) for w in wanted)


def import_from_browser(browser: str, platform: str, dest: Path) -> int:
    """从浏览器提取指定平台的 Cookie 并写入 dest，返回条数。

    可能抛出：浏览器数据不存在 / 系统拒绝解密（钥匙串、完全磁盘访问）等，
    由 API 层统一转成用户可读的提示。
    """
    from yt_dlp.cookies import YoutubeDLCookieJar, extract_cookies_from_browser

    domains = PLATFORM_DOMAINS[platform]
    jar = extract_cookies_from_browser(browser)
    out = YoutubeDLCookieJar(str(dest))
    count = 0
    for c in jar:
        if _match(c.domain, domains):
            out.set_cookie(c)
            count += 1
    if count == 0:
        raise LookupError(f"浏览器里没有该平台的 Cookie，请先在 {browser} 中登录后重试")
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(ignore_discard=True, ignore_expires=True)
    return count
