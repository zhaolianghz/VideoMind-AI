"""API 端点测试（healthz + provider CRUD + 视频列表）。"""
import pytest
from fastapi.testclient import TestClient

from videomind.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_healthz(client):
    r = client.get("/api/v1/system/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "videomind"


def test_system_paths(client):
    r = client.get("/api/v1/system/paths")
    assert r.status_code == 200
    assert "data_dir" in r.json()


def test_provider_crud(client):
    # create
    r = client.post(
        "/api/v1/settings/providers",
        json={
            "name": "TestProvider",
            "kind": "openai_compat",
            "base_url": "https://api.example.com/v1",
            "api_key": "sk-test",
            "default_model": "test-model",
            "enabled": True,
        },
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    # list 含新建
    r = client.get("/api/v1/settings/providers")
    assert any(p["id"] == pid for p in r.json())

    # update（不传 api_key 表示不改）
    r = client.put(f"/api/v1/settings/providers/{pid}", json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"

    # delete
    r = client.delete(f"/api/v1/settings/providers/{pid}")
    assert r.status_code == 204


def test_cookie_list(client):
    r = client.get("/api/v1/settings/cookies")
    assert r.status_code == 200
    platforms = {c["platform"] for c in r.json()}
    assert "bilibili" in platforms


def test_videos_empty(client):
    r = client.get("/api/v1/videos")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
