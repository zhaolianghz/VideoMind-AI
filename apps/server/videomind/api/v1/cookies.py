"""Cookie 导入管理（各平台 cookiefile）。"""
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...core.collector.browser_cookies import (
    import_from_browser,
    supported_browsers,
)
from ...core.collector.cookies import cookiefile_for, resolve_cookiefile
from ...schemas.cookie import CookieInfo, CookieUpload

router = APIRouter()

# 支持的平台（与 collector.platforms 对齐）
PLATFORMS = ["youtube", "bilibili", "douyin", "kuaishou", "xiaohongshu", "tiktok"]

PLATFORM_LABELS = {
    "youtube": "YouTube",
    "bilibili": "B 站",
    "douyin": "抖音",
    "kuaishou": "快手",
    "xiaohongshu": "小红书",
    "tiktok": "TikTok",
}


def _info(path: Path, platform: str) -> CookieInfo:
    exists = path.exists()
    return CookieInfo(
        platform=platform,
        has_cookie=exists,
        size=path.stat().st_size if exists else 0,
        updated_at=(
            datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
            if exists
            else None
        ),
    )


@router.get("", response_model=list[CookieInfo])
def list_cookies() -> list[CookieInfo]:
    return [_info(cookiefile_for(p), p) for p in PLATFORMS]


@router.get("/{platform}")
def get_cookie(platform: str) -> dict:
    path = resolve_cookiefile(platform)
    if not path:
        raise HTTPException(status_code=404, detail="该平台未导入 cookie")
    content = path.read_text(encoding="utf-8")
    return {
        "platform": platform,
        "label": PLATFORM_LABELS.get(platform, platform),
        "lines": len(content.splitlines()),
        "preview": content[:300],
    }


@router.put("/{platform}")
def upload_cookie(platform: str, payload: CookieUpload) -> dict:
    if platform != payload.platform:
        raise HTTPException(status_code=400, detail="platform 不一致")
    if platform not in PLATFORMS:
        raise HTTPException(status_code=400, detail=f"不支持的平台，可选: {PLATFORMS}")
    path = cookiefile_for(platform)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload.content, encoding="utf-8")
    return {"platform": platform, "saved": True, "size": path.stat().st_size}


@router.delete("/{platform}", status_code=204)
def delete_cookie(platform: str) -> None:
    path = cookiefile_for(platform)
    if path.exists():
        path.unlink()


# ── 从浏览器一键导入 ──


class BrowserImportRequest(BaseModel):
    browser: str


def _friendly_error(browser: str, e: Exception) -> str:
    """把 yt-dlp 抛出的底层异常转成普通用户能懂的提示。"""
    msg = str(e)
    low = msg.lower()
    if isinstance(e, LookupError):
        return msg
    if isinstance(e, FileNotFoundError) or "could not find" in low or "no such file" in low:
        return f"未找到 {browser} 的浏览器数据（未安装或从未使用过？）"
    if "permission" in low or "denied" in low or "operation not permitted" in low:
        return (
            f"系统拒绝读取 {browser} 的 Cookie。macOS 请在弹出的钥匙串授权中点“始终允许”；"
            "Safari 需在 系统设置→隐私与安全性→完全磁盘访问 中授权本应用"
        )
    if "keyring" in low or "keychain" in low or "decrypt" in low:
        return f"无法解密 {browser} 的 Cookie（钥匙串授权被拒？请重试并点“始终允许”）"
    return f"读取失败：{msg[:200]}"


@router.get("/browsers/supported")
def list_supported_browsers() -> list[dict]:
    return supported_browsers()


@router.post("/{platform}/import-from-browser")
def import_cookie_from_browser(platform: str, req: BrowserImportRequest) -> dict:
    if platform not in PLATFORMS:
        raise HTTPException(status_code=400, detail=f"不支持的平台，可选: {PLATFORMS}")
    browsers = {b["name"] for b in supported_browsers()}
    if req.browser not in browsers:
        raise HTTPException(status_code=400, detail=f"不支持的浏览器，可选: {sorted(browsers)}")
    try:
        count = import_from_browser(req.browser, platform, cookiefile_for(platform))
    except Exception as e:  # noqa: BLE001 - 底层异常种类繁杂，统一转用户提示
        raise HTTPException(status_code=422, detail=_friendly_error(req.browser, e)) from e
    return {"platform": platform, "browser": req.browser, "cookies": count, "saved": True}
