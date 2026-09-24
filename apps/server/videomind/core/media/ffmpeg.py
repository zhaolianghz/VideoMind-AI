"""FFmpeg 音频提取与时长探测（subprocess 调系统 ffmpeg）。

GUI 应用（Tauri sidecar）的 PATH 很干净（不含 /opt/homebrew/bin 等），
所以除 PATH 外还扫常见安装位置，找到后用绝对路径调用。
"""
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

_COMMON_DIRS = (
    Path("/opt/homebrew/bin"),   # macOS Apple Silicon homebrew
    Path("/usr/local/bin"),      # macOS Intel homebrew / 手动安装
    Path("/usr/bin"),
    Path("/opt/local/bin"),      # MacPorts
)


@lru_cache(maxsize=None)
def _bin(name: str) -> str | None:
    """定位 ffmpeg/ffprobe 可执行文件：先 PATH，再扫常见目录。"""
    found = shutil.which(name)
    if found:
        return found
    for d in _COMMON_DIRS:
        p = d / name
        if p.is_file():
            return str(p)
    return None


def extract_audio(src, dst) -> str:
    """提取音频并转 16kHz 单声道 wav（whisper 标准输入）。"""
    subprocess.run(
        [
            _bin("ffmpeg") or "ffmpeg", "-y", "-i", str(src),
            "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", str(dst),
        ],
        check=True,
        capture_output=True,
    )
    return str(dst)


def extract_thumbnail(src, dst, at_sec: float = 1.0) -> bool:
    """抽一帧做封面（本地导入的视频没有平台封面）。纯音频文件会失败，返回 False。"""
    try:
        subprocess.run(
            [
                _bin("ffmpeg") or "ffmpeg", "-y", "-ss", f"{max(0.0, at_sec):.2f}",
                "-i", str(src), "-frames:v", "1", "-vf", "scale=480:-2", str(dst),
            ],
            check=True,
            capture_output=True,
        )
    except Exception:
        return False
    return Path(dst).is_file()


def probe_duration(path) -> float:
    """ffprobe 取时长（秒）。"""
    result = subprocess.run(
        [
            _bin("ffprobe") or "ffprobe", "-v", "error",
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
    return _bin("ffmpeg") is not None


def ensure_available() -> None:
    if not is_available():
        raise RuntimeError(
            "未检测到 ffmpeg，请先安装（brew install ffmpeg），安装后重试即可"
        )
