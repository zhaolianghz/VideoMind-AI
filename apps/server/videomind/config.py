"""应用配置（pydantic-settings，前缀 VIDEOMIND_）。"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> str:
    """默认数据目录。

    桌面版 sidecar 会把数据存到 macOS 的 app-data 目录（并通过 --data-dir
    显式传入）；dev 裸起 uvicorn 时若该库已存在，优先复用同一份数据，
    避免开发后端指向空库、界面上"数据全没了"。要独立开发库可显式设
    VIDEOMIND_DATA_DIR。
    """
    desktop_dir = (
        Path.home() / "Library" / "Application Support" / "com.videomind.desktop"
    )
    if (desktop_dir / "videomind.db").exists():
        return str(desktop_dir)
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
