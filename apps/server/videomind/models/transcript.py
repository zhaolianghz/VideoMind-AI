"""ASR 转录结果。"""
import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Transcript(SQLModel, table=True):
    __tablename__ = "transcripts"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    video_id: str = Field(foreign_key="videos.id", index=True)
    asr_model: str = ""
    language: str = ""
    duration_sec: int = 0
    segments_json: str = "[]"  # JSON: [{start,end,text}]
    srt_path: str = ""
    vtt_path: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
