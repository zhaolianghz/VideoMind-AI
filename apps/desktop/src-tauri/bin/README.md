# sidecar 目录

PyInstaller 打包后的 `videomind-sidecar.tar.gz`（生产）放在这里，Tauri 作为 resource 打进安装包，首次启动由 Rust 解压。

```bash
./scripts/build_sidecar.sh    # 生成 videomind-sidecar.tar.gz
```

> 该 tar.gz 在 `.gitignore` 中（构建产物，不提交）。
> 开发模式（`make server` + `make web`）不需要 sidecar，走 vite proxy。
> `cargo tauri dev/build` 前需先跑 `build_sidecar.sh` 生成此文件。
