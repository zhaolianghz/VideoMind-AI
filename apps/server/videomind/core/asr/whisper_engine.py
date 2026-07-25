"""faster-whisper 转录引擎封装。

faster-whisper 在 [asr] extra 里，未安装时此模块 import 不受影响
（延迟到 transcribe() 内 import）。
"""
from collections.abc import Callable
from typing import Any

# Whisper 中文训练语料简繁混杂，输出会随机出现繁体。
# 双保险：1) initial_prompt 用简体引导；2) zhconv 强制繁→简。
_ZH_PROMPT = "以下是普通话的句子，请使用简体中文。"


def to_simplified(text: str) -> str:
    """繁体转简体（zhconv 未安装时原样返回）。"""
    try:
        from zhconv import convert
    except ImportError:  # pragma: no cover
        return text
    return convert(text, "zh-hans")


def transcribe(
    audio_path: str,
    model_size: str = "base",
    language: str | None = None,
    has_gpu: bool = False,
    vad_filter: bool = True,
    on_progress: Callable[[int], None] | None = None,
) -> dict[str, Any]:
    """转录音频，返回 {segments, language, duration}。

    on_progress: 收到 0-100 进度（按已转录时间 / 音频总时长）。
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "未安装 faster-whisper，请运行: pip install -e '.[asr]'"
        ) from e

    device = "cuda" if has_gpu else "cpu"
    compute_type = "float16" if has_gpu else "int8"
    # 模型已本地缓存时强制离线：避免 HF 不可达（国内常被墙）时 faster-whisper
    # 在线校验模型把转录无限期卡住。未缓存时不设，正常走下载。
    try:
        import os as _os
        from huggingface_hub.constants import HF_HUB_CACHE
        if _os.path.isdir(
            _os.path.join(HF_HUB_CACHE, f"models--Systran--faster-whisper-{model_size}")
        ):
            _os.environ["HF_HUB_OFFLINE"] = "1"
    except Exception:
        pass
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments_gen, info = model.transcribe(
        audio_path,
        language=language,
        vad_filter=vad_filter,
        initial_prompt=_ZH_PROMPT if language == "zh" else None,
    )
    is_zh = (language or "").startswith("zh")
    total = float(info.duration) or 1.0
    segments = []
    for s in segments_gen:
        text = s.text
        if is_zh or info.language == "zh":
            text = to_simplified(text)
        segments.append(
            {"start": round(s.start, 3), "end": round(s.end, 3), "text": text}
        )
        if on_progress:
            on_progress(min(99, int(s.end * 100 / total)))
    return {
        "segments": segments,
        "language": info.language,
        "duration": float(info.duration),
    }
