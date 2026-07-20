"""视频/转录请求与响应 schema。"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CollectRequest(BaseModel):
    url: str
    download: bool = True  # False = 仅抓元数据（skip-download）
    auto_transcribe: bool = True  # 采集完成后自动 抽音频→转录


class BatchCollectRequest(BaseModel):
    urls: list[str]
    download: bool = True
    auto_transcribe: bool = True


class TranscribeRequest(BaseModel):
    model: str | None = None  # None = 按时长自适应
    language: str | None = None
    vad_filter: bool = True  # 音乐/纯人声视频可关


class VideoRead(BaseModel):
    id: str
    url: str
    platform: str
    title: str
    author: str
    creator_id: str | None = None
    cover_url: str
    cover_path: str = ""
    duration_sec: int
    published_at: datetime | None
    view_count: int
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    favorite_count: int = 0
    source_id: str = ""
    music: str = ""
    comments_fetched: int = 0
    media_path: str
    audio_path: str
    category: str = ""
    tags: str = "[]"
    status: str
    progress: int = 0
    error: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TranscriptRead(BaseModel):
    id: str
    video_id: str
    asr_model: str
    language: str
    duration_sec: int
    segments: list[dict]
    srt_path: str
    vtt_path: str
    created_at: datetime
