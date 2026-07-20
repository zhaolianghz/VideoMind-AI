"""创作者（博主）接口。"""
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, func, select

from ...core.collector import yt_dlp_runner
from ...core.collector.platforms import detect_platform, extract_share_url
from ...db.session import get_session
from ...models.analysis import Analysis
from ...models.creator import Creator
from ...models.provider import ModelProvider
from ...models.video import Video
from ...schemas.analysis import AnalysisRead
from ...services import pipeline

router = APIRouter()


class CreatorRead(BaseModel):
    id: str
    platform: str
    author_id: str
    name: str
    avatar_url: str
    channel_url: str
    video_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ChannelCollectRequest(BaseModel):
    url: str  # 频道/博主主页链接
    limit: int = Field(default=20, ge=1, le=100)
    download: bool = True
    auto_transcribe: bool = True  # 采集完成后自动转录


class ChannelCollectResult(BaseModel):
    found: int  # 频道列表页发现的视频数
    created: int  # 实际新建（去重后）
    skipped: int  # 已存在跳过
    ids: list[str]


class CreatorAnalyzeRequest(BaseModel):
    provider_id: str
    model: str | None = None
    language: str = "zh"


@router.post("/collect", response_model=ChannelCollectResult, status_code=201)
def collect_channel(
    req: ChannelCollectRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> ChannelCollectResult:
    """按博主主页/频道链接批量采集最近 N 条视频。

    同步拉列表页（秒级），逐条视频的下载/元数据走后台 run_collect。
    以 URL 去重：已入库的视频跳过，不重复采集。
    """
    try:
        # 支持整段粘贴主页分享口令，先抽出其中的 URL
        entries = yt_dlp_runner.fetch_channel_videos(extract_share_url(req.url), req.limit)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"无法解析频道链接（私密账号或需要 Cookie？）：{e}",
        ) from e
    if not entries:
        raise HTTPException(status_code=422, detail="频道下未发现视频")

    existing_urls = set(
        session.exec(
            select(Video.url).where(
                Video.url.in_([e["url"] for e in entries if e["url"]])  # type: ignore[union-attr]
            )
        ).all()
    )

    ids: list[str] = []
    skipped = 0
    for entry in entries:
        url = entry["url"]
        if not url:
            continue
        if url in existing_urls:
            skipped += 1
            continue
        video = Video(
            url=url,
            platform=detect_platform(url),
            title=entry["title"],  # 列表页标题先占位，run_collect 会覆盖
            status="collecting",
        )
        session.add(video)
        session.commit()
        session.refresh(video)
        background.add_task(pipeline.run_collect, video.id, req.download, req.auto_transcribe)
        ids.append(video.id)

    return ChannelCollectResult(
        found=len(entries), created=len(ids), skipped=skipped, ids=ids
    )


@router.get("", response_model=list[CreatorRead])
def list_creators(session: Session = Depends(get_session)) -> list[CreatorRead]:
    """博主列表，带视频数，按视频数倒序。"""
    rows = session.exec(
        select(Creator, func.count(Video.id))  # type: ignore[arg-type]
        .join(Video, Video.creator_id == Creator.id, isouter=True)
        .group_by(Creator.id)
        .order_by(func.count(Video.id).desc())
    ).all()
    out = []
    for creator, count in rows:
        item = CreatorRead.model_validate(creator)
        item.video_count = count
        out.append(item)
    return out


@router.get("/{creator_id}", response_model=CreatorRead)
def get_creator(
    creator_id: str, session: Session = Depends(get_session)
) -> CreatorRead:
    creator = session.get(Creator, creator_id)
    if not creator:
        raise HTTPException(status_code=404, detail="creator not found")
    count = session.exec(
        select(func.count(Video.id)).where(Video.creator_id == creator_id)  # type: ignore[arg-type]
    ).one()
    item = CreatorRead.model_validate(creator)
    item.video_count = count
    return item


@router.post("/{creator_id}/analyze", response_model=AnalysisRead, status_code=201)
def analyze_creator(
    creator_id: str,
    req: CreatorAnalyzeRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> AnalysisRead:
    """博主画像分析：聚合该博主已转录视频的摘要，归纳内容策略。"""
    creator = session.get(Creator, creator_id)
    if not creator:
        raise HTTPException(status_code=404, detail="creator not found")
    prov = session.get(ModelProvider, req.provider_id)
    if not prov:
        raise HTTPException(status_code=404, detail="provider not found")
    transcribed = session.exec(
        select(func.count(Video.id))  # type: ignore[arg-type]
        .where(Video.creator_id == creator_id)
        .where(Video.status == "transcribed")
    ).one()
    if not transcribed:
        raise HTTPException(
            status_code=400, detail="该博主名下还没有已转录的视频，请先完成转录"
        )

    a = Analysis(
        creator_id=creator_id,
        template="creator_profile",
        provider_id=req.provider_id,
        model=req.model or prov.default_model or "gpt-4o-mini",
        language=req.language,
        status="running",
    )
    session.add(a)
    session.commit()
    session.refresh(a)
    background.add_task(
        pipeline.run_creator_analyze, a.id, req.provider_id, req.model, req.language
    )
    parsed = json.loads(a.parsed_json) if a.parsed_json else {}
    return AnalysisRead(
        id=a.id,
        video_id=a.video_id,
        creator_id=a.creator_id,
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
