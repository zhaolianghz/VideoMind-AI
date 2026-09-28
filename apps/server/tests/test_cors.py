"""CORS 白名单回归测试。

Windows 上 Tauri 用 WebView2，webview 的 origin 是 `http://tauri.localhost`
（macOS/Linux 是 `tauri://localhost`）。漏了它 → 生产环境所有 API 请求被浏览器
按 CORS 挡掉 → 前端只看到 axios 的 "Network Error"，而 curl 直接打后端却一切正常。
"""
import pytest
from fastapi.testclient import TestClient

from videomind.main import app

# 桌面端各平台的 webview origin + dev 用 vite origin
DESKTOP_ORIGINS = [
    "tauri://localhost",  # macOS / Linux
    "http://tauri.localhost",  # Windows (WebView2)
    "https://tauri.localhost",  # Windows + use_https_scheme
    "http://localhost:1420",  # dev (vite)
]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("origin", DESKTOP_ORIGINS)
def test_desktop_origin_allowed(client, origin):
    r = client.get("/api/v1/system/healthz", headers={"Origin": origin})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == origin, (
        f"{origin} 不在 CORS 白名单里 → 打包后前端所有请求都会 Network Error"
    )


def test_unknown_origin_rejected(client):
    """别的网页不该能拿跨域响应（白名单不能放宽成 *）。"""
    r = client.get(
        "/api/v1/system/healthz", headers={"Origin": "https://evil.example"}
    )
    assert r.headers.get("access-control-allow-origin") is None
