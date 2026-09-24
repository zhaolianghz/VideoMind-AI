"""本地视频导入测试。

覆盖：
- /videos/import/local: 合法文件入库、扩展名过滤、重复路径跳过
- 删除本地导入的视频时不删用户原文件（只清应用目录下的产物）

后台流水线（ffprobe/抽帧/转录）用 monkeypatch 屏蔽，测试只验接口与入库语义。
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from videomind.api.v1 import videos as videos_api
from videomind.db.session import engine
from videomind.main import app
from videomind.models.video import Video


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def no_pipeline(monkeypatch):
    """屏蔽后台任务：不真的调 ffmpeg / whisper。"""
    monkeypatch.setattr(
        videos_api.pipeline, "run_import_local", lambda *a, **k: None
    )


@pytest.fixture
def media_file(tmp_path) -> Path:
    p = tmp_path / "我的视频.mp4"
    p.write_bytes(b"not a real mp4")
    return p


def test_import_creates_video(client, media_file):
    r = client.post(
        "/api/v1/videos/import/local",
        json={"paths": [str(media_file)], "auto_transcribe": False},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created"] == 1
    assert body["skipped"] == 0
    assert body["invalid"] == []

    with Session(engine) as s:
        v = s.get(Video, body["ids"][0])
        assert v is not None
        assert v.platform == "local"
        assert v.title == "我的视频"  # 文件名（不含扩展名）作标题
        assert v.media_path == str(media_file.resolve())
        assert v.url == media_file.resolve().as_uri()


def test_import_skips_duplicate_path(client, media_file):
    first = client.post(
        "/api/v1/videos/import/local", json={"paths": [str(media_file)]}
    )
    assert first.json()["created"] == 1
    again = client.post(
        "/api/v1/videos/import/local", json={"paths": [str(media_file)]}
    )
    assert again.json() == {
        "created": 0,
        "skipped": 1,
        "invalid": [],
        "ids": [],
    }


def test_import_rejects_unsupported_and_missing(client, tmp_path):
    doc = tmp_path / "notes.txt"
    doc.write_text("hello")
    missing = tmp_path / "ghost.mp4"
    r = client.post(
        "/api/v1/videos/import/local",
        json={"paths": [str(doc), str(missing)]},
    )
    assert r.status_code == 400
    assert "视频或音频" in r.json()["detail"]


def test_import_partial_accepts_valid_only(client, tmp_path, media_file):
    doc = tmp_path / "readme.md"
    doc.write_text("x")
    r = client.post(
        "/api/v1/videos/import/local", json={"paths": [str(media_file), str(doc)]}
    )
    body = r.json()
    assert body["created"] == 1
    assert body["invalid"] == [str(doc)]


def test_delete_keeps_user_file(client, media_file):
    """删除本地导入的视频记录时，用户自己的文件必须留在原处。"""
    vid = client.post(
        "/api/v1/videos/import/local", json={"paths": [str(media_file)]}
    ).json()["ids"][0]

    assert client.delete(f"/api/v1/videos/{vid}").status_code == 204
    assert media_file.exists()
    with Session(engine) as s:
        assert s.get(Video, vid) is None


def test_delete_removes_app_owned_media(client):
    """对比用例：媒体目录下的文件（采集产物）照常删除。"""
    from videomind.utils.paths import media_dir

    owned = media_dir() / "owned-clip.mp4"
    owned.write_bytes(b"x")
    with Session(engine) as s:
        v = Video(url="https://t.example/owned", media_path=str(owned))
        s.add(v)
        s.commit()
        vid = v.id

    assert client.delete(f"/api/v1/videos/{vid}").status_code == 204
    assert not owned.exists()
