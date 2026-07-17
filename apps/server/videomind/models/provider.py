"""模型服务商（对齐 clawbox ModelProvider，6 核心字段 + kind + 审计时间）。"""
import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ModelProvider(SQLModel, table=True):
    __tablename__ = "model_providers"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    # kind 只两类：openai_compat (含 OpenAI/通义/DeepSeek/Ollama 等) | anthropic
    kind: str = Field(default="openai_compat")
    base_url: str = ""
    # V1 明文存储（对齐 clawbox）；V2 迁移到 keyring
    api_key: str = ""
    default_model: str = ""
    enabled: bool = True
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
