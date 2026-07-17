"""Anthropic Claude Provider。依赖 anthropic SDK（在 [llm] extra）。"""
from .base import BaseLLMProvider, ChatResult, Message


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, base_url: str, api_key: str):
        from anthropic import Anthropic

        kwargs: dict = {"api_key": api_key or "missing"}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = Anthropic(**kwargs)

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
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        convo = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role != "system"
        ]
        if response_format:
            # Claude 无原生 json mode，靠 prompt 约束
            convo.append(
                {"role": "user", "content": "请严格输出合法 JSON 对象，不要用 markdown 代码块包裹。"}
            )
        resp = self.client.messages.create(
            model=model,
            system=system,
            messages=convo,
            temperature=temperature,
            max_tokens=max_tokens or 4096,
            timeout=timeout,
        )
        text = "".join(
            getattr(b, "text", "")
            for b in resp.content
            if getattr(b, "type", "") == "text"
        )
        usage = {
            "prompt_tokens": getattr(resp.usage, "input_tokens", 0),
            "completion_tokens": getattr(resp.usage, "output_tokens", 0),
        }
        return ChatResult(text=text, usage=usage, raw=resp)
