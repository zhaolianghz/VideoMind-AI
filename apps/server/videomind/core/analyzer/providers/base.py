"""LLM Provider 抽象基类与消息类型。"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Message:
    role: str  # system | user | assistant
    content: str


@dataclass
class ChatResult:
    text: str
    usage: dict[str, Any] = field(default_factory=dict)
    raw: Any = None


class BaseLLMProvider(ABC):
    """统一 LLM 接口，屏蔽各家 SDK 差异。"""

    @abstractmethod
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
        ...

    def ping(self) -> bool:  # pragma: no cover - 可选
        return True
