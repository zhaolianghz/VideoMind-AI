"""根据时长 + 算力自适应选择 whisper 模型。"""


def pick_model(duration_sec: int, has_gpu: bool = False) -> str:
    if duration_sec <= 300:
        model = "tiny"
    elif duration_sec <= 1800:
        model = "base"
    elif duration_sec <= 7200:
        model = "small"
    else:
        model = "medium"

    # CPU 降一级（长视频在 CPU 上跑 medium 不现实）
    if not has_gpu:
        downgrade = {"medium": "small", "small": "base", "base": "tiny", "tiny": "tiny"}
        model = downgrade.get(model, model)
    return model
