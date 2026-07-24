"""Sidecar 入口脚本（供 PyInstaller 打包为单可执行文件）。

命令行参数：
  --port <n>        监听端口（Rust sidecar 探测空闲端口后传入）
  --host <addr>     监听地址，默认 127.0.0.1
  --data-dir <path> 数据目录（SQLite / 媒体 / 字幕）
  --parent-pid <n>  宿主进程 PID；宿主退出后 sidecar 自行退出（防泄漏看门狗）

Tauri 通过 `externalBin` 启动此二进制，并通过 window eval 注入 API base 给前端。
"""
import argparse
import os
import signal
import threading
import time


def _watch_parent(parent_pid: int) -> None:
    """宿主看门狗：Tauri 进程消失（正常退出/崩溃/被 kill）时自杀，避免僵尸 sidecar。

    Rust 侧的 RunEvent::Exit 清理是第一道防线；此处兜底覆盖宿主被强杀、
    崩溃等不会走 Rust 清理路径的情形。
    """
    while True:
        try:
            os.kill(parent_pid, 0)  # 仅探活，不发信号
        except OSError:
            os.kill(os.getpid(), signal.SIGTERM)
            return
        time.sleep(2)


def main() -> None:
    parser = argparse.ArgumentParser(prog="videomind-sidecar")
    parser.add_argument("--port", type=int)
    parser.add_argument("--host", default=None)
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--parent-pid", type=int, default=None)
    args, _ = parser.parse_known_args()

    # 命令行优先于环境变量；pydantic-settings 在 import 时读取环境变量
    if args.data_dir:
        os.environ["VIDEOMIND_DATA_DIR"] = args.data_dir

    if args.parent_pid:
        threading.Thread(
            target=_watch_parent, args=(args.parent_pid,), daemon=True
        ).start()

    from videomind.config import settings

    import uvicorn

    uvicorn.run(
        "videomind.main:app",
        host=args.host or settings.host,
        port=args.port or settings.port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
