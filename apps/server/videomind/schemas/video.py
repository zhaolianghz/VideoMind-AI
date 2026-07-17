"""视频/转录请求与响应 schema。"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CollectRequest(BaseModel):
    url: str
    download: bool = True  # False = 仅抓元数据（skip-download）


class BatchCollectRequest(BaseModel):
    urls: list[str]
    download: bool = True


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
    cover_url: str
    duration_sec: int
    published_at: datetime | None
    view_count: int
    media_path: str
    audio_path: str
    status: str
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
