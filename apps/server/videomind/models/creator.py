"""创作者（博主/账号）实体。"""
import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel, UniqueConstraint


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Creator(SQLModel, table=True):
    __tablename__ = "creators"
    __table_args__ = (
        UniqueConstraint("platform", "author_id", name="uq_creator_platform_author"),
    )

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    platform: str  # youtube/bilibili/douyin/...
    author_id: str  # 平台侧稳定标识（channel_id / uid / sec_uid），改名不变
    name: str = ""  # 显示名，随最新采集更新
    avatar_url: str = ""
    channel_url: str = ""

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
