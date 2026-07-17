"""AI 分析接口。"""
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlmodel import Session, select

from ...db.session import get_session
from ...models.analysis import Analysis
from ...models.provider import ModelProvider
from ...models.video import Video
from ...schemas.analysis import VALID_TEMPLATES, AnalysisRead, AnalyzeRequest
from ...services import pipeline

router = APIRouter()


def _to_read(a: Analysis) -> AnalysisRead:
    try:
        parsed = json.loads(a.parsed_json) if a.parsed_json else {}
    except Exception:
        parsed = {}
    return AnalysisRead(
        id=a.id,
        video_id=a.video_id,
        template=a.template,
        provider_id=a.provider_id,
        model=a.model,
        language=a.language,
        status=a.status,
        parsed=parsed,
        chunks=a.chunks,
        error=a.error,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


@router.get("", response_model=list[AnalysisRead])
def list_analyses(
    video_id: str | None = Query(None),
    session: Session = Depends(get_session),
) -> list[AnalysisRead]:
    q = select(Analysis)
    if video_id:
        q = q.where(Analysis.video_id == video_id)
    return [_to_read(a) for a in session.exec(q).all()]


@router.post("", response_model=AnalysisRead, status_code=201)
def create_analysis(
    req: AnalyzeRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> AnalysisRead:
    if req.template not in VALID_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"模板无效，可选: {VALID_TEMPLATES}")
    if not session.get(Video, req.video_id):
        raise HTTPException(status_code=404, detail="video not found")
    prov = session.get(ModelProvider, req.provider_id)
    if not prov:
        raise HTTPException(status_code=404, detail="provider not found")

    a = Analysis(
        video_id=req.video_id,
        template=req.template,
        provider_id=req.provider_id,
        model=req.model or prov.default_model or "gpt-4o-mini",
        language=req.language,
        status="running",
    )
    session.add(a)
    session.commit()
    session.refresh(a)
    background.add_task(
        pipeline.run_analyze,
        a.id,
        req.provider_id,
        req.model,
        req.language,
        req.fallback_provider_id,
    )
    return _to_read(a)


@router.get("/{analysis_id}", response_model=AnalysisRead)
def get_analysis(
    analysis_id: str, session: Session = Depends(get_session)
) -> AnalysisRead:
    a = session.get(Analysis, analysis_id)
    if not a:
        raise HTTPException(status_code=404, detail="analysis not found")
    return _to_read(a)


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(
    analysis_id: str, session: Session = Depends(get_session)
) -> None:
    a = session.get(Analysis, analysis_id)
    if not a:
        raise HTTPException(status_code=404, detail="analysis not found")
    session.delete(a)
    session.commit()
