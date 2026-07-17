"""Cookie 导入管理（各平台 cookiefile）。"""
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

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
