"""faster-whisper 转录引擎封装。

faster-whisper 在 [asr] extra 里，未安装时此模块 import 不受影响
（延迟到 transcribe() 内 import）。
"""
from typing import Any


def transcribe(
    audio_path: str,
    model_size: str = "base",
    language: str | None = None,
    has_gpu: bool = False,
    vad_filter: bool = True,
) -> dict[str, Any]:
    """转录音频，返回 {segments, language, duration}。"""
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "未安装 faster-whisper，请运行: pip install -e '.[asr]'"
        ) from e

    device = "cuda" if has_gpu else "cpu"
    compute_type = "float16" if has_gpu else "int8"
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments_gen, info = model.transcribe(
        audio_path, language=language, vad_filter=vad_filter
    )
    segments = [
        {"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text}
        for s in segments_gen
    ]
    return {
        "segments": segments,
        "language": info.language,
        "duration": float(info.duration),
    }
