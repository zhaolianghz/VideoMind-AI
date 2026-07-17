"""Cookie 导入 schema。"""
from pydantic import BaseModel


class CookieUpload(BaseModel):
    platform: str  # bilibili/douyin/youtube/...
    content: str   # Netscape 格式 cookie 文本


class CookieInfo(BaseModel):
    platform: str
    has_cookie: bool
    size: int  # bytes
    updated_at: str | None
