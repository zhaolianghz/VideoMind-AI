"""报告导出（Markdown / HTML / PDF）。"""
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session

from ...core.reporter.markdown_report import TEMPLATE_LABELS, render_markdown
from ...core.reporter.pdf_report import markdown_to_html, markdown_to_pdf
from ...db.session import get_session
from ...models.analysis import Analysis
from ...models.video import Video

router = APIRouter()


def _load(analysis_id: str, session: Session) -> tuple[Analysis, Video | None]:
    a = session.get(Analysis, analysis_id)
    if not a:
        raise HTTPException(status_code=404, detail="analysis not found")
    return a, session.get(Video, a.video_id)


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
    md = render_markdown(video, a, parsed, TEMPLATE_LABELS.get(a.template, a.template))
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
