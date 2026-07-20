"""应用偏好设置（key-value，SQLite 持久化）。"""
from sqlmodel import Field, SQLModel


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: str = ""
