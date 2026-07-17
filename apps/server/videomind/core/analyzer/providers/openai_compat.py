"""OpenAI 兼容 Provider（OpenAI / 通义 / DeepSeek / Moonshot / Ollama / vLLM 等）。

依赖 openai SDK（在 [llm] extra）。"""
from .base import BaseLLMProvider, ChatResult, Message


class OpenAICompatProvider(BaseLLMProvider):
    def __init__(self, base_url: str, api_key: str, kind: str = "openai_compat"):
        from openai import OpenAI

        self.client = OpenAI(base_url=base_url or None, api_key=api_key or "missing")
        self.kind = kind

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
        payload: dict = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "timeout": timeout,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if response_format:
            payload["response_format"] = response_format
        resp = self.client.chat.completions.create(**payload)
        text = (resp.choices[0].message.content or "") if resp.choices else ""
        usage: dict = {}
        if getattr(resp, "usage", None):
            usage = {
                "prompt_tokens": resp.usage.prompt_tokens,
                "completion_tokens": resp.usage.completion_tokens,
            }
        return ChatResult(text=text, usage=usage, raw=resp)
