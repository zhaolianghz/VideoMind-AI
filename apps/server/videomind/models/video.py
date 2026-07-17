"""视频实体。"""
import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Video(SQLModel, table=True):
    __tablename__ = "videos"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    url: str
    platform: str = "unknown"  # youtube/bilibili/douyin/...
    title: str = ""
    author: str = ""
    cover_url: str = ""
    duration_sec: int = 0
    published_at: datetime | None = Field(default=None)
    view_count: int = 0

    media_path: str = ""   # yt-dlp 下载的原始文件
    audio_path: str = ""   # ffmpeg 提取的 16kHz mono wav

    # created|collecting|collected|extracting|ready|transcribing|transcribed|failed
    status: str = "created"
    error: str = ""

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
