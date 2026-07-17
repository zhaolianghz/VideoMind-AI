# -*- mode: python ; coding: utf-8 -*-
"""VideoMind AI sidecar PyInstaller spec（生产打包用）。

打包：
    pyinstaller apps/server/videomind_sidecar.spec \
        --distpath apps/desktop/src-tauri/bin \
        --workpath /tmp/vm-py-build --specpath /tmp/vm-py-spec --clean --noconfirm

注意：faster-whisper / weasyprint 含 native 库，PyInstaller 不能跨平台打包，
必须在目标 OS 上执行（macOS 打 mac，Windows 打 win）。
"""
from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

datas = []
binaries = []
hiddenimports = collect_submodules("videomind")

# 可选重型依赖（含 native lib）：已安装则打包，未装则跳过（对应功能在目标机不可用）
for pkg in (
    "faster_whisper",
    "ctranslate2",
    "weasyprint",
    "openai",
    "anthropic",
    "markdown",
    "yt_dlp",
):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        print(f"[spec] 跳过未安装的可选依赖: {pkg}")

a = Analysis(
    ["run_sidecar.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="videomind-sidecar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
