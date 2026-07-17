"""SQLite 数据库引擎与会话。"""
from collections.abc import Generator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

from ..config import settings


def _database_url() -> str:
    if settings.database_url:
        return settings.database_url
    data_dir = Path(settings.data_dir).expanduser()
    data_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{(data_dir / 'videomind.db')}"

engine = create_engine(
    _database_url(),
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """建表。导入所有 model 模块以注册到 SQLModel.metadata。"""
    from ..models import analysis, provider, transcript, video  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
