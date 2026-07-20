"""分析请求/响应 schema。"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel

VALID_TEMPLATES = ("summary", "keypoints", "business", "course", "viral", "classify", "score", "deep", "comments", "recreate")


class AnalyzeRequest(BaseModel):
    video_id: str
    template: str  # summary|keypoints|business|course|viral
    provider_id: str
    model: str | None = None  # None = 用 provider.default_model
    language: str = "zh"  # zh|en
    fallback_provider_id: str | None = None


class AnalysisRead(BaseModel):
    id: str
    video_id: str
    creator_id: str | None = None
    template: str
    provider_id: str
    model: str
    language: str
    status: str
    progress: int = 0
    parsed: dict[str, Any]
    chunks: int
    error: str
    created_at: datetime
    updated_at: datetime
