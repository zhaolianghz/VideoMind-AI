"""AI 分析结果实体。"""
import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Analysis(SQLModel, table=True):
    __tablename__ = "analyses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    video_id: str = Field(foreign_key="videos.id", index=True)
    template: str  # summary|keypoints|business|course|viral
    provider_id: str = ""
    model: str = ""
    language: str = "zh"
    # pending|running|done|failed
    status: str = "pending"
    parsed_json: str = "{}"
    raw_output: str = ""
    chunks: int = 0
    error: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
