"""模型服务商（对齐 clawbox ModelProvider，6 核心字段 + kind + 审计时间）。"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Column
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
    # 可选模型列表（clawbox 导入 / 手动维护），分析时供下拉选择
    models: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # 默认服务商：分析时预选；全表至多一个为 True
    is_default: bool = False
    enabled: bool = True
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
