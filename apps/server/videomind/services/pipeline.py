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
from ..models.transcript import Transcript
from ..models.video import Video
from ..utils.paths import media_dir, subtitles_dir


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def run_collect(video_id: str, download: bool = True) -> None:
    with Session(engine) as s:
        video = s.get(Video, video_id)
        if not video:
            return
        try:
            video.status = "collecting"
            s.add(video)
            s.commit()
            if download:
                meta, media_path = yt_dlp_runner.download_audio(video.url, media_dir())
            else:
                meta = yt_dlp_runner.fetch_metadata(video.url, media_dir())
                media_path = ""
            for k in ("platform", "title", "author", "cover_url", "duration_sec",
                      "published_at", "view_count"):
                setattr(video, k, meta[k])
            video.media_path = media_path
            video.status = "collected" if media_path else "created"
            video.error = ""
        except Exception as e:
            video.status = "failed"
            video.error = str(e)
            s.add(video)
            s.commit()
            raise
        video.updated_at = _utcnow()
        s.add(video)
        s.commit()


def run_extract_audio(video_id: str) -> None:
    with Session(engine) as s:
        video = s.get(Video, video_id)
        if not video or not video.media_path:
            return
        try:
            ffmpeg.ensure_available()
            video.status = "extracting"
            s.add(video)
            s.commit()
            dst = media_dir() / f"{video.id}.wav"
            ffmpeg.extract_audio(video.media_path, dst)
            video.audio_path = str(dst)
            video.status = "ready"
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
            s.add(video)
            s.commit()

            duration = video.duration_sec or int(ffmpeg.probe_duration(video.audio_path))
            chosen = model or model_selector.pick_model(duration, has_gpu=False)
            result = whisper_engine.transcribe(
                video.audio_path, model_size=chosen, language=language,
                vad_filter=vad_filter,
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
            transcript = s.exec(
                select(Transcript).where(Transcript.video_id == a.video_id)
            ).first()
            if not transcript:
                raise RuntimeError("该视频尚无字幕，请先完成转录")
            segs = json.loads(transcript.segments_json)
            text = "\n".join(
                f"[{_fmt_ts_sec(seg['start'])}] {seg['text']}" for seg in segs
            )

            prov_rec = s.get(ModelProvider, provider_id)
            if not prov_rec:
                raise RuntimeError("服务商不存在")
            chosen_model = model or prov_rec.default_model or "gpt-4o-mini"
            a.model = chosen_model
            a.status = "running"
            s.add(a)
            s.commit()

            provider = factory.build_provider(prov_rec)
            try:
                outcome = analyzer.run_analysis(
                    text, a.template, provider, chosen_model, language
                )
            except Exception:
                if not fallback_provider_id:
                    raise
                fb = s.get(ModelProvider, fallback_provider_id)
                if not fb:
                    raise
                provider = factory.build_provider(fb)
                outcome = analyzer.run_analysis(
                    text, a.template, provider, fb.default_model, language
                )

            a.parsed_json = json.dumps(outcome.parsed, ensure_ascii=False)
            a.raw_output = outcome.raw
            a.chunks = outcome.chunks
            a.status = "done"
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
