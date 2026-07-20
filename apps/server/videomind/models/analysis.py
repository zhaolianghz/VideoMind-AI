"""AI 分析结果实体。"""
import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Analysis(SQLModel, table=True):
    __tablename__ = "analyses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    video_id: str = Field(default="", index=True)  # 博主级分析时为空
    creator_id: str | None = Field(default=None, foreign_key="creators.id", index=True)
    template: str  # summary|keypoints|business|course|viral|creator_profile
    provider_id: str = ""
    model: str = ""
    language: str = "zh"
    # pending|running|done|failed
    status: str = "pending"
    progress: int = 0  # running 时的进度 0-100（按分片计）
    parsed_json: str = "{}"
    raw_output: str = ""
    chunks: int = 0
    error: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
