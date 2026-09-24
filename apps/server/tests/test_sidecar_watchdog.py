"""sidecar 宿主看门狗（stdin EOF）回归测试。

背景：旧实现让 sidecar 用 os.kill(parent_pid, 0) 探活。那在 POSIX 成立，在
Windows 不是探活——CPython 直接 OpenProcess + TerminateProcess，导致 Windows
装完 sidecar 启动 6 秒后自己以 exit code 15 退出，界面打不开。

现在靠管道：宿主关掉 stdin 写端（= 进程没了）→ sidecar 读到 EOF → 退出。
"""
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ENTRY = Path(__file__).resolve().parents[1] / "run_sidecar.py"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _spawn(tmp_path: Path, port: int) -> subprocess.Popen:
    return subprocess.Popen(
        [
            sys.executable,
            str(ENTRY),
            "--port",
            str(port),
            "--data-dir",
            str(tmp_path),
            "--watch-host-stdin",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _wait_up(port: int, timeout: float = 30.0) -> bool:
    url = f"http://127.0.0.1:{port}/api/v1/system/healthz"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                return r.status == 200
        except Exception:  # noqa: BLE001 - 还没起来
            time.sleep(0.3)
    return False


def test_sidecar_keeps_running_while_host_alive(tmp_path):
    """宿主还握着 stdin（活着）时，sidecar 不能自己退出。"""
    port = _free_port()
    p = _spawn(tmp_path, port)
    try:
        assert _wait_up(port), "sidecar 未起来"
        time.sleep(3)
        assert p.poll() is None, f"宿主还没死，sidecar 却退出了 rc={p.returncode}"
    finally:
        p.kill()
        p.wait()


def test_sidecar_exits_when_host_stdin_closes(tmp_path):
    """宿主进程消失 → stdin EOF → sidecar 自行退出（防僵尸）。"""
    port = _free_port()
    p = _spawn(tmp_path, port)
    try:
        assert _wait_up(port), "sidecar 未起来"
        p.stdin.close()  # 模拟宿主进程消失
        p.wait(timeout=15)
        assert p.returncode == 0
    finally:
        if p.poll() is None:
            p.kill()
            p.wait()
