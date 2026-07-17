"""测试用 Fake Provider（不联网）。

解析 system prompt 里给出的 JSON 样例，填充占位值返回——
从而能匹配任意模板的输出 schema，用于无 API key 时的端到端验证。
生产 UI 不暴露 kind=fake。
"""
import hashlib
import json

from .base import BaseLLMProvider, ChatResult, Message


def _first_json_object(s: str) -> dict:
    """用栈匹配第一个完整顶层 JSON 对象（正确处理嵌套与字符串内的 {}）。"""
    depth = 0
    start: int | None = None
    in_str = False
    esc = False
    for i, ch in enumerate(s):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start is not None:
                    try:
                        return json.loads(s[start : i + 1])
                    except Exception:
                        start = None
    return {}


def _fill(obj):
    if isinstance(obj, dict):
        return {k: _fill(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_fill(obj[0])] if obj else ["测试"]
    if isinstance(obj, bool):
        return True
    if isinstance(obj, int):
        return 0
    if isinstance(obj, float):
        return 0.0
    if isinstance(obj, str):
        return f"（测试）{obj[:16]}"
    return None


class FakeProvider(BaseLLMProvider):
    def chat(
        self,
        messages: list[Message],
        *,
        model: str,
        temperature: float = 0.3,
        max_tokens: int | None = None,
        response_format: dict | None = None,
        timeout: float = 120,
    ) -> ChatResult:
        full = "\n".join(m.content for m in messages)
        sample = _first_json_object(full)
        filled = _fill(sample)
        filled["_fake"] = True
        filled["_digest"] = hashlib.md5(full.encode()).hexdigest()[:8]
        text = json.dumps(filled, ensure_ascii=False)
        return ChatResult(
            text=text,
            usage={"prompt_tokens": len(full) // 3, "completion_tokens": 40},
        )
