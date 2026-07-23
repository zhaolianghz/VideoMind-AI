"""存储目录自定义 & 报告另存为 测试。

覆盖本次新增功能：
- utils/paths.py: media_dir / report_dir 默认值与自定义解析
- /settings/preferences: media_dir / report_dir 读写持久化
- /system/paths: 返回 report_dir 字段，且反映自定义值
- /reports/{id}/save: 目录优先级（另存为 dir 参数 > 自定义 report_dir > ~/Downloads）

注：报告导出用 md 格式测，避免 weasyprint（PDF）依赖。
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from videomind.db.session import engine
from videomind.main import app
from videomind.models.analysis import Analysis
from videomind.models.video import Video
from videomind.utils.paths import covers_dir, media_dir, report_dir


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_prefs(client):
    """每个测试前后清空自定义目录偏好，隔离测试。"""
    client.put("/api/v1/settings/preferences", json={"media_dir": "", "report_dir": ""})
    yield
    client.put("/api/v1/settings/preferences", json={"media_dir": "", "report_dir": ""})


@pytest.fixture
def done_analysis():
    """插入一条 status=done 的分析记录（含关联视频），返回 analysis_id。"""
    with Session(engine) as s:
        v = Video(url="https://t.example/v", title="测试视频", platform="youtube", author="tester")
        a = Analysis(
            template="summary",
            status="done",
            parsed_json='{"summary":"这是一段测试摘要"}',
            model="test-model",
            language="zh",
        )
        s.add(v)
        s.commit()
        s.refresh(v)
        a.video_id = v.id
        s.add(a)
        s.commit()
        s.refresh(a)
        yield a.id


# ---------- utils/paths.py 直接测试 ----------

def test_media_dir_default():
    """默认 media_dir = data_dir/media。"""
    p = media_dir()
    assert p.name == "media"
    assert p.exists()


def test_report_dir_default():
    """默认 report_dir = ~/Downloads。"""
    assert report_dir() == Path.home() / "Downloads"


def test_covers_dir_default():
    assert covers_dir().name == "covers"


# ---------- /system/paths ----------

def test_system_paths_has_report_dir(client):
    """/system/paths 应返回新增的 report_dir 字段。"""
    body = client.get("/api/v1/system/paths").json()
    for key in ("data_dir", "media_dir", "report_dir", "subtitles_dir", "cookies_dir"):
        assert key in body, f"缺少字段 {key}"
    assert body["report_dir"] == str(Path.home() / "Downloads")


# ---------- /settings/preferences ----------

def test_preferences_media_report_roundtrip(client):
    """media_dir / report_dir 可写可读。"""
    r = client.put("/api/v1/settings/preferences", json={
        "media_dir": "/tmp/vm-media-xyz",
        "report_dir": "/tmp/vm-report-xyz",
    })
    assert r.status_code == 200
    assert r.json()["media_dir"] == "/tmp/vm-media-xyz"
    assert r.json()["report_dir"] == "/tmp/vm-report-xyz"

    body = client.get("/api/v1/settings/preferences").json()
    assert body["media_dir"] == "/tmp/vm-media-xyz"
    assert body["report_dir"] == "/tmp/vm-report-xyz"


def test_system_paths_reflects_custom_report_dir(client, tmp_path):
    """设置自定义 report_dir 后，/system/paths 反映实际目录。"""
    client.put("/api/v1/settings/preferences", json={"report_dir": str(tmp_path)})
    body = client.get("/api/v1/system/paths").json()
    assert body["report_dir"] == str(tmp_path)


def test_media_dir_follows_custom(client, tmp_path):
    """设置自定义 media_dir 后，utils.paths.media_dir() 跟随（下载会落此目录）。"""
    client.put("/api/v1/settings/preferences", json={"media_dir": str(tmp_path)})
    assert media_dir() == tmp_path


# ---------- /reports/{id}/save 目录优先级 ----------

def test_save_report_default_downloads(client, done_analysis):
    """未配 report_dir → 落 ~/Downloads（md 格式）。"""
    r = client.post(f"/api/v1/reports/{done_analysis}/save", params={"fmt": "md"})
    assert r.status_code == 200
    path = Path(r.json()["path"])
    assert path.parent == Path.home() / "Downloads"
    assert path.exists()
    assert "测试视频" in path.name
    path.unlink(missing_ok=True)


def test_save_report_custom_dir(client, done_analysis, tmp_path):
    """配了 report_dir → 落该目录。"""
    client.put("/api/v1/settings/preferences", json={"report_dir": str(tmp_path)})
    r = client.post(f"/api/v1/reports/{done_analysis}/save", params={"fmt": "md"})
    assert r.status_code == 200
    path = Path(r.json()["path"])
    assert path.parent == tmp_path
    assert path.exists()
    path.unlink(missing_ok=True)


def test_save_report_dir_param_overrides(client, done_analysis, tmp_path):
    """?dir= 参数优先级最高（另存为），即便配了 report_dir 也用 dir。"""
    configured = tmp_path / "configured"
    configured.mkdir()
    override = tmp_path / "override"
    client.put("/api/v1/settings/preferences", json={"report_dir": str(configured)})
    r = client.post(
        f"/api/v1/reports/{done_analysis}/save",
        params={"fmt": "md", "dir": str(override)},
    )
    assert r.status_code == 200
    path = Path(r.json()["path"])
    assert path.parent == override  # 用 dir，不用配置的 configured
    assert not (configured / path.name).exists()
    assert path.exists()
    path.unlink(missing_ok=True)


def test_save_report_creates_missing_dir(client, done_analysis, tmp_path):
    """目标目录不存在时自动创建。"""
    nested = tmp_path / "a" / "b" / "c"
    r = client.post(
        f"/api/v1/reports/{done_analysis}/save",
        params={"fmt": "md", "dir": str(nested)},
    )
    assert r.status_code == 200
    path = Path(r.json()["path"])
    assert nested.exists()
    assert path.parent == nested
    path.unlink(missing_ok=True)
