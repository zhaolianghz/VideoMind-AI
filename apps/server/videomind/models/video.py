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
    creator_id: str | None = Field(default=None, foreign_key="creators.id", index=True)
    cover_url: str = ""
    cover_path: str = ""  # 本地封面文件（cover_url 有时效签名，落盘一份）
    duration_sec: int = 0
    published_at: datetime | None = Field(default=None)
    view_count: int = 0
    # 互动数据（采集时来自平台元数据；平台不提供的字段为 0）
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    favorite_count: int = 0  # 收藏数（抖音等）
    source_id: str = ""  # 平台视频唯一 ID
    music: str = ""  # 背景音乐名
    # 评论（按需抓取，JSON 数组 [{author,text,like_count}]）
    comments_json: str = "[]"
    comments_fetched: int = 0

    media_path: str = ""   # yt-dlp 下载的原始文件
    audio_path: str = ""   # ffmpeg 提取的 16kHz mono wav

    # 内容分类：category 为固定枚举（LLM classify 覆盖平台原生分类），
    # tags 为 JSON 字符串数组（与 segments_json 同样的存法）
    category: str = Field(default="", index=True)
    tags: str = "[]"

    # created|collecting|collected|extracting|ready|transcribing|transcribed|failed
    status: str = "created"
    progress: int = 0  # 当前阶段进度 0-100（collecting/extracting/transcribing 时有意义）
    error: str = ""

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
