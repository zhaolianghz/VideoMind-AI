"""pytest 配置：在 videomind 加载前指定临时数据目录，避免污染 ~/.videomind。"""
import os
import tempfile

os.environ.setdefault("VIDEOMIND_DATA_DIR", tempfile.mkdtemp(prefix="vm-pytest-"))
