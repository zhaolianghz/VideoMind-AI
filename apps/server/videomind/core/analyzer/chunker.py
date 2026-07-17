"""长文本切片（按字符数，尽量在换行处断开）。"""

MAX_CHARS = 4000  # ≈ 1300 tokens，对 8k 上下文模型安全


def chunk_text(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    cur = ""
    for block in text.split("\n"):
        if cur and len(cur) + len(block) + 1 > max_chars:
            chunks.append(cur)
            cur = block
        else:
            cur = f"{cur}\n{block}" if cur else block
    if cur:
        chunks.append(cur)

    # 单块仍超长（无换行的超长段）→ 硬切
    final: list[str] = []
    for c in chunks:
        while len(c) > max_chars:
            final.append(c[:max_chars])
            c = c[max_chars:]
        if c:
            final.append(c)
    return final
