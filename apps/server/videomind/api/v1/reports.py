"""报告导出（Markdown / HTML / PDF）。"""
import json
import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session

from ...core.reporter.markdown_report import TEMPLATE_LABELS, render_markdown
from ...core.reporter.pdf_report import markdown_to_html, markdown_to_pdf
from ...db.session import get_session
from ...models.analysis import Analysis
from ...models.creator import Creator
from ...models.video import Video

router = APIRouter()


def _load(analysis_id: str, session: Session) -> tuple[Analysis, Video | None]:
    a = session.get(Analysis, analysis_id)
    if not a:
        raise HTTPException(status_code=404, detail="analysis not found")
    video = session.get(Video, a.video_id) if a.video_id else None
    return a, video


@router.get("/{analysis_id}/export", response_model=None)
def export_report(
    analysis_id: str,
    fmt: str = Query("md", pattern="md|html|pdf"),
    session: Session = Depends(get_session),
) -> Response:
    a, video = _load(analysis_id, session)
    if a.status != "done":
        raise HTTPException(status_code=400, detail="分析未完成，无法导出")

    parsed = json.loads(a.parsed_json) if a.parsed_json else {}
    creator = session.get(Creator, a.creator_id) if a.creator_id else None
    md = render_markdown(
        video, a, parsed, TEMPLATE_LABELS.get(a.template, a.template), creator=creator
    )
    # 文件名用纯 ASCII（HTTP header 不支持非 ASCII）；标题中文只出现在正文
    safe = f"{a.template}-{analysis_id[:8]}"

    if fmt == "md":
        return Response(
            content=md,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe}-{a.template}.md"'},
        )
    if fmt == "html":
        return Response(
            content=markdown_to_html(md),
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe}-{a.template}.html"'},
        )
    pdf = markdown_to_pdf(md)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe}-{a.template}.pdf"'},
    )


def _safe_filename(text: str, fallback: str) -> str:
    """标题转文件名：去掉路径分隔符等非法字符。"""
    name = re.sub(r'[/\\:*?"<>|\r\n]+', " ", text).strip()
    return (name[:50] or fallback)


@router.post("/{analysis_id}/save")
def save_report(
    analysis_id: str,
    fmt: str = Query("md", pattern="md|html|pdf"),
    session: Session = Depends(get_session),
) -> dict:
    """把报告写入 ~/Downloads 并返回路径。

    桌面端（Tauri WKWebView）不支持 <a download>，点浏览器式下载链接会把
    整个 webview 导航到文件 URL 导致界面"回不来"，所以改为后端落盘。
    """
    a, video = _load(analysis_id, session)
    if a.status != "done":
        raise HTTPException(status_code=400, detail="分析未完成，无法导出")

    parsed = json.loads(a.parsed_json) if a.parsed_json else {}
    creator = session.get(Creator, a.creator_id) if a.creator_id else None
    md = render_markdown(
        video, a, parsed, TEMPLATE_LABELS.get(a.template, a.template), creator=creator
    )
    label = TEMPLATE_LABELS.get(a.template, a.template)
    base = _safe_filename(
        f"{getattr(video, 'title', '') or getattr(creator, 'name', '')}-{label}",
        f"{a.template}-{analysis_id[:8]}",
    )
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    downloads = Path.home() / "Downloads"
    downloads.mkdir(parents=True, exist_ok=True)

    if fmt == "md":
        path = downloads / f"{base}_{stamp}.md"
        path.write_text(md, encoding="utf-8")
    elif fmt == "html":
        path = downloads / f"{base}_{stamp}.html"
        path.write_text(markdown_to_html(md), encoding="utf-8")
    else:
        path = downloads / f"{base}_{stamp}.pdf"
        path.write_bytes(markdown_to_pdf(md))
    return {"path": str(path), "filename": path.name}
