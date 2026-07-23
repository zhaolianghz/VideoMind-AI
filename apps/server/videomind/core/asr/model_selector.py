"""根据时长 + 算力自适应选择 whisper 模型。

原则：质量优先。短视频转录成本本来就低，必须用高质量模型；
只有长视频才为等待时间向速度让步。tiny/base 的中文效果不可用，
仅作超长视频的兜底。
"""


def pick_model(duration_sec: int, has_gpu: bool = False) -> str:
    if has_gpu:
        return "medium" if duration_sec <= 7200 else "small"

    # CPU（faster-whisper int8）：small 约 5-10x 实时，1 小时内都可接受
    if duration_sec <= 3600:
        return "small"
    return "base"
