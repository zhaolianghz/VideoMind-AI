"""字幕接口（JSON / SRT / VTT）。"""
import json
from pathlib import Path

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select

from ...db.session import get_session
from ...models.transcript import Transcript
from ...schemas.video import TranscriptRead

router = APIRouter()


@router.get("/{video_id}", response_model=None)
def get_transcript(
    video_id: str,
    fmt: str = Query("json", pattern="json|srt|vtt"),
    session: Session = Depends(get_session),
) -> Any:
    transcript = session.exec(
        select(Transcript).where(Transcript.video_id == video_id)
    ).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="transcript not found")

    if fmt == "json":
        return TranscriptRead(
            id=transcript.id,
            video_id=transcript.video_id,
            asr_model=transcript.asr_model,
            language=transcript.language,
            duration_sec=transcript.duration_sec,
            segments=json.loads(transcript.segments_json),
            srt_path=transcript.srt_path,
            vtt_path=transcript.vtt_path,
            created_at=transcript.created_at,
        )

    path = Path(transcript.srt_path if fmt == "srt" else transcript.vtt_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="字幕文件不存在")
    media_type = "application/x-subrip" if fmt == "srt" else "text/vtt"
    return Response(content=path.read_text(encoding="utf-8"), media_type=media_type)
