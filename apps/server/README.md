# VideoMind AI Backend

Python FastAPI 服务，承载视频采集 / ASR / AI 分析 / 报告生成全管线。

## 开发

```bash
pip install -e ".[dev]"          # 或: uv pip install -e ".[dev]"
uvicorn videomind.main:app --reload --port 18791
```

健康检查：`GET http://127.0.0.1:18791/api/v1/system/healthz`

API 文档：`http://127.0.0.1:18791/docs`

## 配置

环境变量（前缀 `VIDEOMIND_`），或 `.env` 文件：

| 变量 | 默认 | 说明 |
|------|------|------|
| `VIDEOMIND_HOST` | 127.0.0.1 | 监听地址 |
| `VIDEOMIND_PORT` | 18791 | 监听端口 |
| `VIDEOMIND_DATA_DIR` | ~/.videomind | 数据目录（SQLite 等） |
| `VIDEOMIND_DATABASE_URL` | （空=SQLite） | 数据库 URL，空则用 `$DATA_DIR/videomind.db` |
| `VIDEOMIND_CORS_ORIGINS` | localhost:1420,5173,tauri | CORS，逗号分隔 |
