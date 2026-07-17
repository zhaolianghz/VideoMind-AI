"""Markdown → HTML → PDF（markdown + weasyprint）。"""

_CSS = """
body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
       line-height: 1.75; color: #1f2937; max-width: 720px; margin: 40px auto; padding: 0 24px; }
h1 { border-bottom: 2px solid #10b981; padding-bottom: 8px; color: #111827; }
h2 { color: #059669; margin-top: 28px; }
blockquote { border-left: 4px solid #10b981; margin: 12px 0; padding: 6px 16px;
             background: #f0fdf4; color: #374151; }
code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
"""


def markdown_to_html(md: str) -> str:
    import markdown

    body = markdown.markdown(md, extensions=["tables", "fenced_code", "sane_lists"])
    return f"<html><head><meta charset='utf-8'><style>{_CSS}</style></head><body>{body}</body></html>"


def markdown_to_pdf(md: str) -> bytes:
    import weasyprint

    return weasyprint.HTML(string=markdown_to_html(md)).write_pdf()
