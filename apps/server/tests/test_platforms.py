"""平台识别测试。"""
from videomind.core.collector.platforms import detect_platform


def test_bilibili():
    assert detect_platform("https://www.bilibili.com/video/BV1xx") == "bilibili"
    assert detect_platform("https://b23.tv/abc") == "bilibili"


def test_douyin():
    assert detect_platform("https://www.douyin.com/video/123") == "douyin"


def test_youtube():
    assert detect_platform("https://www.youtube.com/watch?v=abc") == "youtube"
    assert detect_platform("https://youtu.be/abc") == "youtube"


def test_xiaohongshu():
    assert detect_platform("https://www.xiaohongshu.com/explore/xxx") == "xiaohongshu"
    assert detect_platform("https://xhslink.com/abc") == "xiaohongshu"


def test_unknown():
    assert detect_platform("https://example.com/some") == "unknown"
