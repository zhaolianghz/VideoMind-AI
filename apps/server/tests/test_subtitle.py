"""SRT / VTT 字幕生成测试。"""
from videomind.core.asr.subtitle import segments_to_srt, segments_to_vtt

SEGMENTS = [
    {"start": 0.0, "end": 1.5, "text": "你好"},
    {"start": 1.5, "end": 3.0, "text": "世界"},
]


def test_srt_format():
    srt = segments_to_srt(SEGMENTS)
    assert "1\n" in srt  # 序号
    assert "00:00:00,000 --> 00:00:01,500" in srt  # SRT 用逗号毫秒
    assert "你好" in srt and "世界" in srt


def test_vtt_format():
    vtt = segments_to_vtt(SEGMENTS)
    assert vtt.startswith("WEBVTT")
    assert "00:00:00.000 --> 00:00:01.500" in vtt  # VTT 用点毫秒


def test_empty_segments():
    assert segments_to_srt([]).strip() == ""
    assert segments_to_vtt([]).strip() == "WEBVTT"
