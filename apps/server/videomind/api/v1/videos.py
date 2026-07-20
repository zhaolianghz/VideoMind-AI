"""视频采集 / 处理接口。"""
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from ...core.collector import yt_dlp_runner
from ...core.collector.platforms import (
    canonicalize_url,
    detect_platform,
    extract_share_url,
)
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
def list_videos(
    creator_id: str | None = None,
    category: str | None = None,
    session: Session = Depends(get_session),
) -> list[Video]:
    stmt = select(Video)
    if creator_id:
        stmt = stmt.where(Video.creator_id == creator_id)
    if category:
        stmt = stmt.where(Video.category == category)
    return list(session.exec(stmt).all())


@router.post("/collect", response_model=VideoRead, status_code=201)
def collect(
    req: CollectRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> Video:
    # 支持整段粘贴分享口令（「2.38 复制打开抖音…https://v.douyin.com/xxx/ …」）；
    # canonicalize 把 youtu.be/shorts/watch?v= 等形式归一，同一视频不重复入库
    url = canonicalize_url(extract_share_url(req.url))
    existing = session.exec(select(Video).where(Video.url == url)).first()
    if existing:
        # 已存在：失败的自动重采，其余直接返回已有记录，不重复下载
        if existing.status == "failed":
            existing.status = "collecting"
            existing.error = ""
            session.add(existing)
            session.commit()
            session.refresh(existing)
            background.add_task(pipeline.run_collect, existing.id, req.download, req.auto_transcribe)
        return existing
    video = Video(url=url, platform=detect_platform(url), status="collecting")
    session.add(video)
    session.commit()
    session.refresh(video)
    background.add_task(pipeline.run_collect, video.id, req.download, req.auto_transcribe)
    return video


@router.post("/collect/batch", status_code=201)
def collect_batch(
    req: BatchCollectRequest,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
) -> dict:
    """批量采集：逐个 URL 入队后台采集；已存在的跳过，不重复下载。"""
    ids: list[str] = []
    skipped = 0
    seen: set[str] = set()
    for raw in req.urls:
        url = canonicalize_url(extract_share_url(raw))
        if not url:
            continue
        if url in seen or session.exec(select(Video).where(Video.url == url)).first():
            skipped += 1
            continue
        seen.add(url)
        video = Video(url=url, platform=detect_platform(url), status="collecting")
        session.add(video)
        session.commit()
        session.refresh(video)
        background.add_task(pipeline.run_collect, video.id, req.download, req.auto_transcribe)
        ids.append(video.id)
    return {"created": len(ids), "skipped": skipped, "ids": ids}


@router.post("/{video_id}/recollect", response_model=VideoRead)
def recollect(
    video_id: str,
    background: BackgroundTasks,
    download: bool = True,
    session: Session = Depends(get_session),
) -> Video:
    """重新采集（导入 Cookie 后重试失败的视频）。"""
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")
    video.status = "collecting"
    video.error = ""
    session.add(video)
    session.commit()
    session.refresh(video)
    background.add_task(pipeline.run_collect, video.id, download)
    return video


@router.post("/export/csv")
def export_videos_csv(session: Session = Depends(get_session)) -> dict:
    """导出数据总表 CSV 到 ~/Downloads（utf-8-sig，Excel 直接打开不乱码）。

    每行一条视频：基础信息 + 互动数据 + 最新一次「爆款五维评分」+ 口播稿全文。
    """
    import csv
    import json as _json
    from datetime import datetime as _dt
    from pathlib import Path as _Path

    from ...models.analysis import Analysis
    from ...models.transcript import Transcript

    videos = list(session.exec(select(Video)).all())
    if not videos:
        raise HTTPException(status_code=400, detail="视频库为空，没有可导出的数据")

    # 每个视频取最新一次完成的评分（按 created_at 升序遍历，后者覆盖前者）
    scores: dict[str, dict] = {}
    for a in session.exec(
        select(Analysis)
        .where(Analysis.template == "score")
        .where(Analysis.status == "done")
        .order_by(Analysis.created_at)  # type: ignore[arg-type]
    ).all():
        try:
            scores[a.video_id] = _json.loads(a.parsed_json or "{}")
        except Exception:
            continue

    transcripts: dict[str, str] = {}
    for t in session.exec(select(Transcript)).all():
        try:
            segs = _json.loads(t.segments_json or "[]")
            transcripts[t.video_id] = " ".join(
                seg["text"].strip() for seg in segs if seg.get("text")
            )
        except Exception:
            continue

    downloads = _Path.home() / "Downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    path = downloads / f"VideoMind数据表_{_dt.now():%Y%m%d_%H%M%S}.csv"
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow([
            "视频链接", "视频标题", "视频ID", "作者", "平台", "音乐", "时长(秒)",
            "播放数", "点赞数", "评论数", "分享数", "收藏数", "分类", "标签",
            "情绪分", "冲突分", "张力分", "信息差分", "共鸣分", "总分",
            "内容摘要", "评分依据", "热门评论", "口播稿",
        ])
        for v in videos:
            sc = scores.get(v.id, {})
            try:
                tags = "、".join(_json.loads(v.tags or "[]"))
            except Exception:
                tags = ""
            try:
                top_comments = "\n".join(
                    f"[赞{c.get('like_count', 0)}] {c.get('text', '')}"
                    for c in _json.loads(v.comments_json or "[]")[:20]
                )
            except Exception:
                top_comments = ""
            w.writerow([
                v.url, v.title, v.source_id, v.author, v.platform, v.music,
                v.duration_sec, v.view_count, v.like_count, v.comment_count,
                v.share_count, v.favorite_count, v.category, tags,
                sc.get("emotion", ""), sc.get("conflict", ""), sc.get("tension", ""),
                sc.get("info_gap", ""), sc.get("resonance", ""), sc.get("total", ""),
                sc.get("summary", ""), sc.get("rationale", ""), top_comments,
                transcripts.get(v.id, ""),
            ])
    return {"path": str(path), "rows": len(videos), "scored": len(scores)}


@router.post("/{video_id}/comments/fetch")
def fetch_video_comments(
    video_id: str,
    limit: int = 100,
    session: Session = Depends(get_session),
) -> dict:
    """按需抓取视频评论并落库（YouTube 按热度取前 N 条）。"""
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")
    try:
        comments = yt_dlp_runner.fetch_comments(video.url, max(10, min(limit, 300)))
    except Exception as e:
        raise HTTPException(
            status_code=422, detail=yt_dlp_runner.friendly_error(e)
        ) from e
    if not comments:
        raise HTTPException(
            status_code=422,
            detail="未抓到评论：该平台可能不支持评论抓取（当前主要支持 YouTube），或视频暂无评论",
        )
    video.comments_json = json.dumps(comments, ensure_ascii=False)
    video.comments_fetched = len(comments)
    video.updated_at = datetime.now(timezone.utc)
    session.add(video)
    session.commit()
    return {"video_id": video_id, "count": len(comments)}


@router.get("/{video_id}/comments")
def get_video_comments(
    video_id: str, session: Session = Depends(get_session)
) -> dict:
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")
    comments = json.loads(video.comments_json or "[]")
    return {"video_id": video_id, "count": len(comments), "comments": comments}


@router.get("/{video_id}/cover")
def get_cover(video_id: str, session: Session = Depends(get_session)) -> FileResponse:
    """返回本地封面文件（采集时已落盘，不受 CDN 签名过期影响）。"""
    video = session.get(Video, video_id)
    if not video or not video.cover_path or not Path(video.cover_path).exists():
        raise HTTPException(status_code=404, detail="cover not found")
    return FileResponse(video.cover_path)


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
    """删除视频及其全部关联：本地文件（媒体/音频/封面/字幕文件）+ 字幕/分析记录。"""
    from ...models.analysis import Analysis
    from ...models.transcript import Transcript

    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="video not found")

    # 磁盘文件
    for p in (video.media_path, video.audio_path, video.cover_path):
        if p:
            Path(p).unlink(missing_ok=True)
    # 字幕记录 + srt/vtt 文件
    for t in session.exec(
        select(Transcript).where(Transcript.video_id == video_id)
    ).all():
        for p in (t.srt_path, t.vtt_path):
            if p:
                Path(p).unlink(missing_ok=True)
        session.delete(t)
    # 分析记录
    for a in session.exec(
        select(Analysis).where(Analysis.video_id == video_id)
    ).all():
        session.delete(a)

    session.delete(video)
    session.commit()
