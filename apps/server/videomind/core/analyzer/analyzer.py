"""AI 分析编排：模板渲染 → 切片 → 单段或 map-reduce → JSON 解析校验（含 1 次容错重试）。"""
import json
import re
from dataclasses import dataclass
from typing import Any

from jinja2 import Template

from .chunker import chunk_text
from .providers.base import BaseLLMProvider, Message
from .templates import PARTIAL_SYSTEM, TEMPLATES, TemplateDef

JSON_FORMAT = {"type": "json_object"}


@dataclass
class AnalysisOutcome:
    parsed: dict[str, Any]
    raw: str
    chunks: int


def _strip_noise(text: str) -> str:
    """去除推理模型的 <think>...</think> 思考块 + markdown 代码块包裹。"""
    t = text.strip()
    t = re.sub(r"<think>.*?</think>", "", t, flags=re.S)
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _extract_first_json(s: str) -> dict | None:
    """用栈匹配提取第一个完整顶层 JSON 对象（容忍前导文本/思考块）。"""
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
    return None


def _parse_json(text: str) -> dict:
    clean = _strip_noise(text)
    obj = _extract_first_json(clean)
    if obj is not None:
        return obj
    return json.loads(clean)  # 保留原始解析错误信息


def _render(tpl_str: str, **kwargs) -> str:
    return Template(tpl_str).render(**kwargs)


def _lang_hint(language: str) -> str:
    return "请用中文输出。" if language != "en" else "Answer in English."


def _chat_json(
    provider: BaseLLMProvider,
    messages: list[Message],
    model: str,
    schema: type,
) -> tuple[dict, str]:
    """调用 LLM 并校验 JSON，失败追加修正提示重试 1 次。"""
    msgs = list(messages)
    last_err: Exception | None = None
    for _ in range(2):
        result = provider.chat(msgs, model=model, response_format=JSON_FORMAT)
        try:
            parsed = schema.model_validate(_parse_json(result.text)).model_dump()
            return parsed, result.text
        except Exception as e:  # JSON 解析或 schema 校验失败
            last_err = e
            msgs = msgs + [
                Message("assistant", result.text),
                Message(
                    "user",
                    f"上一次输出不是合法 JSON 或不符合要求（{e}）。"
                    "请严格按指定 JSON 结构重新输出，仅输出 JSON。",
                ),
            ]
    assert last_err is not None
    raise last_err


def run_analysis(
    transcript: str,
    template_name: str,
    provider: BaseLLMProvider,
    model: str,
    language: str = "zh",
) -> AnalysisOutcome:
    tpl: TemplateDef = TEMPLATES[template_name]
    chunks = chunk_text(transcript) or ["（无转录文本）"]
    hint = _lang_hint(language)

    if len(chunks) == 1:
        messages = [
            Message("system", f"{tpl.system}\n{hint}"),
            Message("user", _render(tpl.user, transcript=chunks[0])),
        ]
        parsed, raw = _chat_json(provider, messages, model, tpl.schema)
        return AnalysisOutcome(parsed=parsed, raw=raw, chunks=1)

    # ── map-reduce：分片提炼 → 合并归纳 ──
    partials: list[str] = []
    for idx, chunk in enumerate(chunks, 1):
        messages = [
            Message("system", f"{PARTIAL_SYSTEM}\n{hint}"),
            Message("user", f"这是第 {idx}/{len(chunks)} 片段：\n\n{chunk}"),
        ]
        partials.append(provider.chat(messages, model=model).text)

    merged = "\n\n---\n\n".join(partials)
    messages = [
        Message(
            "system",
            f"{tpl.system}\n以下是对长视频各片段的初步分析，请合并去重并归纳为最终 JSON。\n{hint}",
        ),
        Message("user", merged),
    ]
    parsed, raw = _chat_json(provider, messages, model, tpl.schema)
    return AnalysisOutcome(parsed=parsed, raw=raw, chunks=len(chunks))
