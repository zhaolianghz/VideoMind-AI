"""长文本切片测试。"""
from videomind.core.analyzer.chunker import chunk_text


def test_short_single_chunk():
    assert chunk_text("短文本") == ["短文本"]


def test_empty():
    assert chunk_text("") == []


def test_long_splits():
    text = "段落内容。\n" * 500  # ~3000 字符
    chunks = chunk_text(text, max_chars=200)
    assert len(chunks) > 1


def test_respects_max_chars_with_long_lines():
    # 无换行的超长段 → 硬切，每块不超 max_chars
    text = "字" * 1000
    chunks = chunk_text(text, max_chars=100)
    assert all(len(c) <= 100 for c in chunks)
    assert "".join(chunks) == text
