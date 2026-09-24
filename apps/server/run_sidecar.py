"""Sidecar 入口脚本（供 PyInstaller 打包为单可执行文件）。

命令行参数：
  --port <n>           监听端口（Rust sidecar 探测空闲端口后传入）
  --host <addr>        监听地址，默认 127.0.0.1
  --data-dir <path>    数据目录（SQLite / 媒体 / 字幕）
  --watch-host-stdin   宿主退出看门狗：stdin 管道 EOF（= 宿主进程没了）时自杀

Tauri 通过 `externalBin` 启动此二进制，并通过 window eval 注入 API base 给前端。
"""
import argparse
import os
import sys
import threading


def _watch_host_stdin() -> None:
    """宿主看门狗：宿主消失时它持有的 stdin 写端被系统关闭，这里读到 EOF 就自杀。

    Rust 侧的 RunEvent::Exit 清理是第一道防线；此处兜底覆盖宿主被强杀、
    崩溃等不会走 Rust 清理路径的情形。

    不要改回 os.kill(pid, 0) 探活：那在 POSIX 成立，在 Windows 不是探活——
    CPython 对非 CTRL_* 的 sig 直接 OpenProcess(PROCESS_ALL_ACCESS) +
    TerminateProcess(sig)，所以要么拿权限杀了父进程，要么 OpenProcess 失败
    抛 OSError → 被当成“宿主已死” → sidecar 自己 SIGTERM 退出（exit code 15）。
    管道 EOF 是 OS 原生的父死信号：无权限、无 PID 复用、跨平台一致。
    """
    stdin = getattr(sys.stdin, "buffer", None)
    if stdin is None:  # 无 stdin（pythonw / 无控制台）→ 放弃看门狗，不影响服务
        return
    try:
        while stdin.read(1):  # 宿主从不写入，第一次 read 阻塞到 EOF
            pass
    except Exception:  # noqa: BLE001 - 管道异常同样视为宿主消失
        pass
    os._exit(0)


def main() -> None:
    parser = argparse.ArgumentParser(prog="videomind-sidecar")
    parser.add_argument("--port", type=int)
    parser.add_argument("--host", default=None)
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--watch-host-stdin", action="store_true")
    args, _ = parser.parse_known_args()

    # 命令行优先于环境变量；pydantic-settings 在 import 时读取环境变量
    if args.data_dir:
        os.environ["VIDEOMIND_DATA_DIR"] = args.data_dir

    if args.watch_host_stdin:
        threading.Thread(target=_watch_host_stdin, daemon=True).start()

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
