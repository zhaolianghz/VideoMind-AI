"""媒体文件 serve（供前端 <video>/<audio> 播放，支持 range 请求拖动）。"""
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session

from ...db.session import get_session
from ...models.video import Video

router = APIRouter()


@router.get("/{video_id}", response_model=None)
def get_media(video_id: str, session: Session = Depends(get_session)) -> FileResponse:
    v = session.get(Video, video_id)
    if not v:
        raise HTTPException(status_code=404, detail="video not found")
    path = v.media_path or v.audio_path
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="媒体文件不存在（可能未下载或已清理）")
    return FileResponse(path)
