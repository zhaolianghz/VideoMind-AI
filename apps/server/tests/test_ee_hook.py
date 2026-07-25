"""EE 插件点：CE 单独运行完全不受影响；EE 加载失败被隔离。"""
import importlib.util

import pytest
from fastapi.testclient import TestClient

from videomind.main import create_app

HAS_EE = importlib.util.find_spec("videomind_ee") is not None


def test_app_boots_and_healthz_ok():
    client = TestClient(create_app())
    assert client.get("/api/v1/system/healthz").status_code == 200


@pytest.mark.skipif(HAS_EE, reason="本环境装了 videomind-ee，license 路由应存在")
def test_license_absent_without_ee():
    client = TestClient(create_app())
    assert client.get("/api/v1/license/status").status_code == 404


@pytest.mark.skipif(not HAS_EE, reason="本环境未装 videomind-ee")
def test_license_present_with_ee():
    client = TestClient(create_app())
    assert client.get("/api/v1/license/status").status_code == 200


def test_ee_crash_is_isolated(monkeypatch):
    """register() 抛异常时 CE 照常工作。"""
    import videomind.main as m

    class BoomEE:
        @staticmethod
        def register(app):
            raise RuntimeError("boom")

    monkeypatch.setattr(m, "_import_ee", lambda: BoomEE)
    client = TestClient(create_app())
    assert client.get("/api/v1/system/healthz").status_code == 200
