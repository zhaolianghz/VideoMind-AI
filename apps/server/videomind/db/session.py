"""SQLite 数据库引擎与会话。"""
from collections.abc import Generator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine, select

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
    from ..models import analysis, creator, provider, setting, transcript, video  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _migrate()


def _migrate() -> None:
    """轻量迁移：create_all 不会给已有表加列，此处补齐 + 回填老数据。"""
    from sqlalchemy import text

    with engine.begin() as conn:
        cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(videos)")).fetchall()
        }
        if "cover_path" not in cols:
            conn.execute(
                text("ALTER TABLE videos ADD COLUMN cover_path VARCHAR DEFAULT ''")
            )
        if "creator_id" not in cols:
            conn.execute(text("ALTER TABLE videos ADD COLUMN creator_id VARCHAR"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_videos_creator_id "
                    "ON videos (creator_id)"
                )
            )
        if "category" not in cols:
            conn.execute(
                text("ALTER TABLE videos ADD COLUMN category VARCHAR DEFAULT ''")
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_videos_category "
                    "ON videos (category)"
                )
            )
        if "tags" not in cols:
            conn.execute(
                text("ALTER TABLE videos ADD COLUMN tags VARCHAR DEFAULT '[]'")
            )
        if "progress" not in cols:
            conn.execute(
                text("ALTER TABLE videos ADD COLUMN progress INTEGER DEFAULT 0")
            )
        for col, ddl in (
            ("like_count", "INTEGER DEFAULT 0"),
            ("comment_count", "INTEGER DEFAULT 0"),
            ("share_count", "INTEGER DEFAULT 0"),
            ("favorite_count", "INTEGER DEFAULT 0"),
            ("source_id", "VARCHAR DEFAULT ''"),
            ("music", "VARCHAR DEFAULT ''"),
            ("comments_json", "TEXT DEFAULT '[]'"),
            ("comments_fetched", "INTEGER DEFAULT 0"),
        ):
            if col not in cols:
                conn.execute(text(f"ALTER TABLE videos ADD COLUMN {col} {ddl}"))
        acols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(analyses)")).fetchall()
        }
        if acols and "creator_id" not in acols:
            conn.execute(text("ALTER TABLE analyses ADD COLUMN creator_id VARCHAR"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_analyses_creator_id "
                    "ON analyses (creator_id)"
                )
            )
        if acols and "progress" not in acols:
            conn.execute(
                text("ALTER TABLE analyses ADD COLUMN progress INTEGER DEFAULT 0")
            )
        pcols = {
            row[1]
            for row in conn.execute(
                text("PRAGMA table_info(model_providers)")
            ).fetchall()
        }
        if pcols and "models" not in pcols:
            conn.execute(
                text("ALTER TABLE model_providers ADD COLUMN models JSON DEFAULT '[]'")
            )
        if pcols and "is_default" not in pcols:
            conn.execute(
                text(
                    "ALTER TABLE model_providers "
                    "ADD COLUMN is_default BOOLEAN DEFAULT 0"
                )
            )
    _backfill_creators()


def _backfill_creators() -> None:
    """按老数据的 (platform, author) 建 Creator 并回填 video.creator_id。

    老数据没有稳定 author_id，退化用显示名；后续重新采集会以真实
    channel_id/uid 建新 Creator 并重新关联。幂等：只处理 creator_id 为空的行。
    """
    from ..models.creator import Creator
    from ..models.video import Video

    with Session(engine) as s:
        orphans = s.exec(
            select(Video).where(Video.creator_id.is_(None)).where(Video.author != "")  # type: ignore[union-attr]
        ).all()
        if not orphans:
            return
        cache: dict[tuple[str, str], str] = {}
        for v in orphans:
            key = (v.platform, v.author)
            if key not in cache:
                existing = s.exec(
                    select(Creator)
                    .where(Creator.platform == v.platform)
                    .where(Creator.author_id == v.author)
                ).first()
                if not existing:
                    existing = Creator(
                        platform=v.platform, author_id=v.author, name=v.author
                    )
                    s.add(existing)
                    s.flush()
                cache[key] = existing.id
            v.creator_id = cache[key]
            s.add(v)
        s.commit()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
