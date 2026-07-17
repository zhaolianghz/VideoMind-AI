"""视频采集 / 处理接口。"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session, select

from ...core.collector.platforms import detect_platform
from ...db.session import get_session
from ...models.video import Video
from ...schemas.video import (
    BatchCollectRequest,
    CollectRequest,
    TranscribeRequest,
    VideoRead,
)
from ...services import pipeline

router = APIRouter()


@router.get("", response_model=list[VideoRead])
def list_videos(session: Session = Depends(get_session)) -> list[Video]:
    return list(session.exec(select(Video)).all())


@router.post("/collect", response_model=VideoRead, status_code=201)
def collect(
    req: CollectRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> Video:
    video = Video(url=req.url, platform=detect_platform(req.url), status="collecting")
    session.add(video)
    session.commit()
    session.refresh(video)
    background.add_task(pipeline.run_collect, video.id, req.download)
    return video


@router.post("/collect/batch", status_code=201)
def collect_batch(
    req: BatchCollectRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> dict:
    """批量采集：逐个 URL 入队后台采集。"""
    ids: list[str] = []
    for raw in req.urls:
        url = raw.strip()
        if not url:
            continue
        video = Video(url=url, platform=detect_platform(url), status="collecting")
        session.add(video)
        session.commit()
        session.refresh(video)
        background.add_task(pipeline.run_collect, video.id, req.download)
        ids.append(video.id)
    return {"created": len(ids), "ids": ids}


@router.get("/{video_id}", response_model=VideoRead)
def get_video(video_id: str, session: Session = Depends(get_session)) -> Video:
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")
    return video


@router.post("/{video_id}/extract-audio", response_model=VideoRead)
def extract_audio(
    video_id: str,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> Video:
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")
    if not video.media_path:
        raise HTTPException(status_code=400, detail="视频尚未采集，无法提取音频")
    background.add_task(pipeline.run_extract_audio, video_id)
    return video


@router.post("/{video_id}/transcribe", response_model=VideoRead)
def transcribe(
    video_id: str,
    req: TranscribeRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> Video:
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")
    background.add_task(
        pipeline.run_transcribe, video_id, req.model, req.language, req.vad_filter
    )
    return video


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: str, session: Session = Depends(get_session)) -> None:
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")
    session.delete(video)
    session.commit()
