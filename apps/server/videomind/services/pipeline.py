"""P1 采集 → 抽音频 → 转录 编排（同步；P3 换 Celery + 状态机）。

这些函数供 FastAPI BackgroundTasks 在后台调用，各自管理独立的 DB Session。
"""
import json
from datetime import datetime, timezone

from sqlmodel import Session, select

from ..core.asr import model_selector, subtitle, whisper_engine
from ..core.collector import yt_dlp_runner
from ..core.media import ffmpeg
from ..db.session import engine
from ..models.creator import Creator
from ..models.transcript import Transcript
from ..models.video import Video
from ..utils.paths import covers_dir, media_dir, subtitles_dir


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _progress_writer(model_cls, row_id: str):
    """返回节流的进度写入回调：独立短事务写 progress 列，不与主事务冲突。

    yt-dlp/whisper 的回调频率很高，按“进度变化 >= 2%”节流，避免 SQLite 写风暴。
    """
    last = {"v": -1}

    def write(pct: int) -> None:
        pct = max(0, min(100, int(pct)))
        if pct - last["v"] < 2 and pct != 100:
            return
        last["v"] = pct
        try:
            with Session(engine) as ps:
                row = ps.get(model_cls, row_id)
                if row:
                    row.progress = pct
                    ps.add(row)
                    ps.commit()
        except Exception:
            pass  # 进度写失败不影响主流程

    return write


def _get_or_create_creator(s: Session, meta: dict) -> Creator | None:
    """按 (platform, author_id) 查找或创建创作者；显示名/主页随最新采集刷新。"""
    author_id = meta.get("author_id") or ""
    if not author_id:
        return None
    creator = s.exec(
        select(Creator)
        .where(Creator.platform == meta["platform"])
        .where(Creator.author_id == author_id)
    ).first()
    if creator:
        changed = False
        if meta.get("author") and creator.name != meta["author"]:
            creator.name = meta["author"]
            changed = True
        if meta.get("channel_url") and creator.channel_url != meta["channel_url"]:
            creator.channel_url = meta["channel_url"]
            changed = True
        if changed:
            creator.updated_at = _utcnow()
            s.add(creator)
    else:
        creator = Creator(
            platform=meta["platform"],
            author_id=author_id,
            name=meta.get("author", ""),
            channel_url=meta.get("channel_url", ""),
        )
        s.add(creator)
        s.flush()  # 拿到 creator.id，随外层事务一起提交
    return creator


def run_collect(
    video_id: str, download: bool = True, auto_transcribe: bool = False
) -> None:
    with Session(engine) as s:
        video = s.get(Video, video_id)
        if not video:
            return
        try:
            video.status = "collecting"
            video.progress = 0
            s.add(video)
            s.commit()
            from pathlib import Path as _Path

            # 已有媒体文件（重新采集场景）：只刷新元数据，不重复下载
            has_media = bool(video.media_path) and _Path(video.media_path).exists()
            if download and not has_media:
                meta, media_path = yt_dlp_runner.download_audio(
                    video.url, media_dir(),
                    on_progress=_progress_writer(Video, video_id),
                )
            else:
                meta = yt_dlp_runner.fetch_metadata(video.url, media_dir())
                media_path = video.media_path if has_media else ""

            # 兜底去重：URL 形式不同（分享短链等）但平台视频 ID 相同 → 合并到已有记录
            dup = None
            if meta.get("source_id"):
                dup = s.exec(
                    select(Video)
                    .where(Video.platform == meta["platform"])
                    .where(Video.source_id == meta["source_id"])
                    .where(Video.id != video.id)
                ).first()
            if dup:
                # 新下载的文件转给已有记录（或删掉多余文件），删除当前重复行
                if media_path and media_path != dup.media_path:
                    if dup.media_path and _Path(dup.media_path).exists():
                        _Path(media_path).unlink(missing_ok=True)
                    else:
                        dup.media_path = media_path
                        if dup.status in ("created", "failed"):
                            dup.status = "collected"
                # 顺带刷新互动数据（点赞等会随时间变化）
                for k in ("view_count", "like_count", "comment_count",
                          "share_count", "favorite_count"):
                    setattr(dup, k, meta[k])
                dup.updated_at = _utcnow()
                s.add(dup)
                s.delete(video)
                s.commit()
                return

            for k in ("platform", "title", "author", "cover_url", "duration_sec",
                      "published_at", "view_count", "like_count", "comment_count",
                      "share_count", "favorite_count", "source_id", "music"):
                setattr(video, k, meta[k])
            # 平台原生分类作冷启动值；不覆盖已有值（可能来自 LLM classify）
            if meta.get("category") and not video.category:
                video.category = meta["category"]
            if meta.get("tags") and video.tags in ("", "[]"):
                video.tags = json.dumps(meta["tags"], ensure_ascii=False)
            video.cover_path = yt_dlp_runner.download_cover(
                meta["cover_url"], covers_dir(), video.id
            )
            creator = _get_or_create_creator(s, meta)
            video.creator_id = creator.id if creator else None
            video.media_path = media_path
            video.status = "collected" if media_path else "created"
            video.progress = 100
            video.error = ""
        except Exception as e:
            video.status = "failed"
            video.error = yt_dlp_runner.friendly_error(e)
            s.add(video)
            s.commit()
            raise
        video.updated_at = _utcnow()
        s.add(video)
        s.commit()
        collected_media = bool(video.media_path)

    # 自动流水线：采集成功且有媒体文件 → 直接接转录（内部会先抽音频）
    if auto_transcribe and collected_media:
        run_transcribe(video_id)


def run_extract_audio(video_id: str) -> None:
    with Session(engine) as s:
        video = s.get(Video, video_id)
        if not video or not video.media_path:
            return
        try:
            ffmpeg.ensure_available()
            video.status = "extracting"
            video.progress = 10
            s.add(video)
            s.commit()
            dst = media_dir() / f"{video.id}.wav"
            ffmpeg.extract_audio(video.media_path, dst)
            video.audio_path = str(dst)
            video.status = "ready"
            video.progress = 100
            video.error = ""
        except Exception as e:
            video.status = "failed"
            video.error = str(e)
        video.updated_at = _utcnow()
        s.add(video)
        s.commit()


def run_transcribe(
    video_id: str,
    model: str | None = None,
    language: str | None = None,
    vad_filter: bool = True,
) -> None:
    # 若无音频，先抽音频
    with Session(engine) as s:
        video = s.get(Video, video_id)
        if not video:
            return
        need_extract = not video.audio_path
    if need_extract:
        run_extract_audio(video_id)

    with Session(engine) as s:
        video = s.get(Video, video_id)
        if not video or not video.audio_path:
            return
        try:
            video.status = "transcribing"
            video.progress = 0
            s.add(video)
            s.commit()

            # 用户偏好兜底（设置页配置的默认模型/语言）
            from ..models.setting import AppSetting

            if not model:
                pref_m = s.get(AppSetting, "transcribe_model")
                if pref_m and pref_m.value and pref_m.value != "auto":
                    model = pref_m.value
            if not language:
                pref_l = s.get(AppSetting, "transcribe_language")
                if pref_l and pref_l.value and pref_l.value != "auto":
                    language = pref_l.value

            duration = video.duration_sec or int(ffmpeg.probe_duration(video.audio_path))
            chosen = model or model_selector.pick_model(duration, has_gpu=False)
            result = whisper_engine.transcribe(
                video.audio_path, model_size=chosen, language=language,
                vad_filter=vad_filter,
                on_progress=_progress_writer(Video, video_id),
            )
            segments = result["segments"]

            srt_path = subtitles_dir() / f"{video.id}.srt"
            vtt_path = subtitles_dir() / f"{video.id}.vtt"
            srt_path.write_text(subtitle.segments_to_srt(segments), encoding="utf-8")
            vtt_path.write_text(subtitle.segments_to_vtt(segments), encoding="utf-8")

            for old in s.exec(
                select(Transcript).where(Transcript.video_id == video_id)
            ).all():
                s.delete(old)

            s.add(
                Transcript(
                    video_id=video_id,
                    asr_model=chosen,
                    language=result["language"],
                    duration_sec=int(result["duration"]),
                    segments_json=json.dumps(segments, ensure_ascii=False),
                    srt_path=str(srt_path),
                    vtt_path=str(vtt_path),
                )
            )
            video.status = "transcribed"
            video.progress = 100
            video.error = ""
            video.updated_at = _utcnow()
            s.add(video)
            s.commit()
        except Exception as e:
            video = s.get(Video, video_id)
            if video:
                video.status = "failed"
                video.error = str(e)
                video.updated_at = _utcnow()
                s.add(video)
                s.commit()
            raise


def _fmt_ts_sec(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def run_analyze(
    analysis_id: str,
    provider_id: str,
    model: str | None,
    language: str,
    fallback_provider_id: str | None = None,
) -> None:
    """AI 分析编排：取字幕 → 选服务商 → 分析(map-reduce) → 存结构化结果。"""
    from ..core.analyzer import analyzer
    from ..core.analyzer.providers import factory
    from ..models.analysis import Analysis
    from ..models.provider import ModelProvider

    with Session(engine) as s:
        a = s.get(Analysis, analysis_id)
        if not a:
            return
        try:
            video = s.get(Video, a.video_id) if a.video_id else None

            if a.template == "comments":
                # 用户洞察：输入是评论而非字幕
                comments = json.loads(video.comments_json or "[]") if video else []
                if not comments:
                    raise RuntimeError("还没有抓取评论：请先到视频库该视频点「抓评论」")
                text = "\n".join(
                    f"[赞{c.get('like_count', 0)}] {c.get('author', '')}: {c.get('text', '')}"
                    for c in comments
                )
            else:
                transcript = s.exec(
                    select(Transcript).where(Transcript.video_id == a.video_id)
                ).first()
                if not transcript:
                    raise RuntimeError("该视频尚无字幕，请先完成转录")
                segs = json.loads(transcript.segments_json)
                text = "\n".join(
                    f"[{_fmt_ts_sec(seg['start'])}] {seg['text']}" for seg in segs
                )
                if a.template == "recreate":
                    # 二创：附带最近一次深度拆解/评分结论，供提取爆款逻辑
                    prior = s.exec(
                        select(Analysis)
                        .where(Analysis.video_id == a.video_id)
                        .where(Analysis.template.in_(["deep", "score"]))  # type: ignore[attr-defined]
                        .where(Analysis.status == "done")
                        .order_by(Analysis.created_at.desc())  # type: ignore[attr-defined]
                    ).first()
                    if prior:
                        text += (
                            "\n\n【该视频已有分析结论（JSON，供提取底层爆款逻辑）】\n"
                            + prior.parsed_json
                        )

            prov_rec = s.get(ModelProvider, provider_id)
            if not prov_rec:
                raise RuntimeError("服务商不存在")
            chosen_model = model or prov_rec.default_model or "gpt-4o-mini"
            a.model = chosen_model
            a.status = "running"
            a.progress = 0
            s.add(a)
            s.commit()

            provider = factory.build_provider(prov_rec)

            def _run(p, m):
                if a.template == "deep":
                    from ..core.analyzer import deep

                    video_meta = {}
                    if video:
                        video_meta = {
                            "title": video.title, "author": video.author,
                            "duration_sec": video.duration_sec,
                            "view_count": video.view_count,
                            "like_count": video.like_count,
                            "comment_count": video.comment_count,
                            "share_count": video.share_count,
                            "favorite_count": video.favorite_count,
                        }
                        # 已抓取的热门评论注入（供用户反馈维度参考）
                        cs = json.loads(video.comments_json or "[]")[:30]
                        if cs:
                            video_meta["comments_text"] = "\n".join(
                                f"[赞{c.get('like_count', 0)}] {c.get('text', '')}"
                                for c in cs
                            )
                    return deep.run_deep(
                        video_meta, text, p, m, language,
                        on_progress=_progress_writer(Analysis, analysis_id),
                    )
                return analyzer.run_analysis(
                    text, a.template, p, m, language,
                    on_progress=_progress_writer(Analysis, analysis_id),
                )

            try:
                outcome = _run(provider, chosen_model)
            except Exception:
                if not fallback_provider_id:
                    raise
                fb = s.get(ModelProvider, fallback_provider_id)
                if not fb:
                    raise
                provider = factory.build_provider(fb)
                outcome = _run(provider, fb.default_model)

            a.parsed_json = json.dumps(outcome.parsed, ensure_ascii=False)
            a.raw_output = outcome.raw
            a.chunks = outcome.chunks
            a.status = "done"
            a.progress = 100
            a.error = ""

            # classify 模板：结果回写 Video，供 Library 筛选
            if a.template == "classify" and a.video_id:
                video = s.get(Video, a.video_id)
                if video:
                    video.category = outcome.parsed.get("category", "") or "其他"
                    video.tags = json.dumps(
                        outcome.parsed.get("tags", []), ensure_ascii=False
                    )
                    video.updated_at = _utcnow()
                    s.add(video)
        except Exception as e:
            a = s.get(Analysis, analysis_id)
            if a:
                a.status = "failed"
                a.error = str(e)
        if a:
            a.updated_at = _utcnow()
            s.add(a)
            s.commit()


def run_creator_analyze(
    analysis_id: str,
    provider_id: str,
    model: str | None,
    language: str,
) -> None:
    """博主画像分析：map(逐视频摘要) → reduce(creator_profile 归纳)。

    map 阶段复用已完成的 summary 分析结果作缓存；没有的视频现场生成
    摘要但不落库（避免污染用户的分析记录列表）。
    """
    from ..core.analyzer import analyzer
    from ..core.analyzer.providers import factory
    from ..core.analyzer.providers.base import Message
    from ..models.analysis import Analysis
    from ..models.provider import ModelProvider

    with Session(engine) as s:
        a = s.get(Analysis, analysis_id)
        if not a or not a.creator_id:
            return
        try:
            videos = s.exec(
                select(Video).where(Video.creator_id == a.creator_id)
            ).all()
            # 只取有转录的视频
            transcribed = [v for v in videos if v.status == "transcribed"]
            if not transcribed:
                raise RuntimeError("该博主名下还没有已转录的视频，请先完成转录")

            prov_rec = s.get(ModelProvider, provider_id)
            if not prov_rec:
                raise RuntimeError("服务商不存在")
            chosen_model = model or prov_rec.default_model or "gpt-4o-mini"
            a.model = chosen_model
            a.status = "running"
            a.progress = 0
            s.add(a)
            s.commit()
            provider = factory.build_provider(prov_rec)
            report = _progress_writer(Analysis, analysis_id)

            # ── map：逐视频拿摘要（优先复用已有 summary 分析）──
            digests: list[str] = []
            for vi, v in enumerate(transcribed, 1):
                done_summary = s.exec(
                    select(Analysis)
                    .where(Analysis.video_id == v.id)
                    .where(Analysis.template == "summary")
                    .where(Analysis.status == "done")
                ).first()
                if done_summary:
                    summary = json.loads(done_summary.parsed_json).get("summary", "")
                else:
                    transcript = s.exec(
                        select(Transcript).where(Transcript.video_id == v.id)
                    ).first()
                    if not transcript:
                        continue
                    segs = json.loads(transcript.segments_json)
                    text = "\n".join(seg["text"] for seg in segs)
                    # 现场生成摘要（截断长文本，画像分析不需要逐句细节）
                    messages = [
                        Message(
                            "system",
                            "用 200 字以内中文概括这条视频的主题、观点与形式。",
                        ),
                        Message("user", text[:8000]),
                    ]
                    summary = provider.chat(messages, model=chosen_model).text
                if summary:
                    digests.append(
                        f"《{v.title}》({v.view_count:,} 播放)\n{summary}"
                    )
                report(int(vi * 85 / len(transcribed)))

            if not digests:
                raise RuntimeError("没有可用的视频摘要")

            # ── reduce：摘要合集喂 creator_profile 模板 ──
            merged = "\n\n---\n\n".join(digests)
            outcome = analyzer.run_analysis(
                merged, "creator_profile", provider, chosen_model, language
            )

            a.parsed_json = json.dumps(outcome.parsed, ensure_ascii=False)
            a.raw_output = outcome.raw
            a.chunks = len(digests)
            a.status = "done"
            a.progress = 100
            a.error = ""
        except Exception as e:
            a = s.get(Analysis, analysis_id)
            if a:
                a.status = "failed"
                a.error = str(e)
        if a:
            a.updated_at = _utcnow()
            s.add(a)
            s.commit()
