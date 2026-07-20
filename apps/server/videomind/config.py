"""应用配置（pydantic-settings，前缀 VIDEOMIND_）。"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> str:
    return str(Path.home() / ".videomind")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VIDEOMIND_", env_file=".env", extra="ignore"
    )

    host: str = "127.0.0.1"
    port: int = 18791
    data_dir: str = _default_data_dir()
    database_url: str = ""  # 空 = 用 SQLite at data_dir/videomind.db
    cors_origins: str = (
        "http://localhost:1420,http://localhost:5173,tauri://localhost"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def media_dir(self) -> Path:
        p = Path(self.data_dir).expanduser() / "media"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def subtitles_dir(self) -> Path:
        p = Path(self.data_dir).expanduser() / "subtitles"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def covers_dir(self) -> Path:
        p = Path(self.data_dir).expanduser() / "covers"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def cookies_dir(self) -> Path:
        p = Path(self.data_dir).expanduser() / "cookies"
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
