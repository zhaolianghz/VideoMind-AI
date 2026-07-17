"""FFmpeg 音频提取与时长探测（subprocess 调系统 ffmpeg）。"""
import subprocess
from pathlib import Path


def extract_audio(src, dst) -> str:
    """提取音频并转 16kHz 单声道 wav（whisper 标准输入）。"""
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(src),
            "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", str(dst),
        ],
        check=True,
        capture_output=True,
    )
    return str(dst)


def probe_duration(path) -> float:
    """ffprobe 取时长（秒）。"""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def is_available() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def ensure_available() -> None:
    if not is_available():
        raise RuntimeError("未检测到 ffmpeg，请先安装（brew install ffmpeg / apt install ffmpeg）")
