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


class ProviderTest(BaseModel):
    """测试连接：真实调一次 chat 接口验证配置可用。"""

    kind: str = "openai_compat"
    base_url: str = ""
    api_key: str = ""  # 留空且带 provider_id 时用已存的 Key
    model: str = ""
    provider_id: str | None = None


class ProviderTestResult(BaseModel):
    success: bool
    message: str
    latency_ms: int


class ProviderRead(ProviderBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
