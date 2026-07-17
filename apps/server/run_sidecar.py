"""Sidecar 入口脚本（供 PyInstaller 打包为单可执行文件）。

命令行参数：
  --port <n>        监听端口（Rust sidecar 探测空闲端口后传入）
  --host <addr>     监听地址，默认 127.0.0.1
  --data-dir <path> 数据目录（SQLite / 媒体 / 字幕）

Tauri 通过 `externalBin` 启动此二进制，并通过 window eval 注入 API base 给前端。
"""
import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(prog="videomind-sidecar")
    parser.add_argument("--port", type=int)
    parser.add_argument("--host", default=None)
    parser.add_argument("--data-dir", default=None)
    args, _ = parser.parse_known_args()

    # 命令行优先于环境变量；pydantic-settings 在 import 时读取环境变量
    if args.data_dir:
        os.environ["VIDEOMIND_DATA_DIR"] = args.data_dir

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
