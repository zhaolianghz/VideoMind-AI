"""AI 分析 JSON 解析测试（含推理模型 think 块、代码块、前导文本）。"""
from videomind.core.analyzer.analyzer import _extract_first_json, _parse_json


def test_parse_plain():
    assert _parse_json('{"a": 1}') == {"a": 1}


def test_parse_codeblock():
    assert _parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_think_block():
    # 推理模型（MiniMax-M3 / DeepSeek-R1）输出 think + JSON
    text = "<think>分析中...</think>\n\n{\"a\": 1}"
    assert _parse_json(text) == {"a": 1}


def test_parse_think_with_leading_text():
    text = "<think>...</think>\n根据分析：\n{\"target\": \"x\"}"
    assert _parse_json(text) == {"target": "x"}


def test_extract_first_json_with_prefix():
    assert _extract_first_json('prefix {"a": 1} suffix') == {"a": 1}


def test_extract_first_json_nested():
    s = 'noise {"a": {"b": 2}, "c": [1, 2]} tail'
    assert _extract_first_json(s) == {"a": {"b": 2}, "c": [1, 2]}


def test_extract_first_json_none():
    assert _extract_first_json("no json here") is None


def test_extract_first_json_braces_in_string():
    # 字符串内的 {} 不应破坏栈匹配
    s = '{"text": "contains } and { inside"}'
    assert _extract_first_json(s) == {"text": "contains } and { inside"}
