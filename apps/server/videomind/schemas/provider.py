"""Provider 请求/响应 schema。"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProviderBase(BaseModel):
    name: str
    kind: str = "openai_compat"  # openai_compat | anthropic
    base_url: str = ""
    api_key: str = ""
    default_model: str = ""
    enabled: bool = True


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    name: str | None = None
    kind: str | None = None
    base_url: str | None = None
    api_key: str | None = None  # None 或空串 = 不修改
    default_model: str | None = None
    enabled: bool | None = None


class ProviderRead(ProviderBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
