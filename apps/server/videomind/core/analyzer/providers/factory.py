"""Provider 工厂：根据 ModelProvider 记录构建 LLMProvider 实例。"""
from ....models.provider import ModelProvider
from .base import BaseLLMProvider


def build_provider(rec: ModelProvider) -> BaseLLMProvider:
    if rec.kind == "fake":
        # 仅测试/开发用
        from .fake import FakeProvider

        return FakeProvider()
    if rec.kind == "anthropic":
        from .anthropic_provider import AnthropicProvider

        return AnthropicProvider(rec.base_url, rec.api_key)
    # 默认 openai_compat（含 OpenAI/通义/DeepSeek/Ollama 等）
    from .openai_compat import OpenAICompatProvider

    return OpenAICompatProvider(rec.base_url, rec.api_key, rec.kind)
