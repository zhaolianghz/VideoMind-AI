"""将分析结果渲染为 Markdown 报告。"""
from datetime import datetime
from typing import Any

LABELS: dict[str, str] = {
    "summary": "摘要", "point": "观点", "evidence": "论据",
    "target_users": "目标用户", "monetization": "盈利方式", "growth_strategy": "增长策略",
    "competitive_edge": "竞争优势", "risks": "风险", "opportunities": "机会",
    "chapter": "章节", "topics": "知识点", "knowledge_points": "知识点列表",
    "cases": "案例", "target_audience": "适合人群",
    "title_patterns": "标题规律", "hook_analysis": "开头钩子分析", "content_structure": "内容结构",
    "spread_mechanism": "传播机制", "replication_model": "复制模型",
}

TEMPLATE_LABELS: dict[str, str] = {
    "summary": "视频摘要", "keypoints": "核心观点", "business": "商业模式分析",
    "course": "课程拆解分析", "viral": "爆款规律分析",
}


def _label(key: str) -> str:
    return LABELS.get(key, key)


def render_markdown(video: Any, analysis: Any, parsed: dict, template_label: str) -> str:
    title = (getattr(video, "title", None) if video else None) or "视频分析报告"
    out: list[str] = [f"# {title}", ""]

    if video:
        out.append(f"> **作者**：{video.author}  ")
        out.append(f"> **平台**：{video.platform}  ")
        out.append(f"> **时长**：{video.duration_sec} 秒  ")
        if video.published_at:
            out.append(f"> **发布**：{video.published_at.strftime('%Y-%m-%d')}  ")
    out.append(f"> **分析模板**：{template_label}  ")
    out.append(f"> **模型**：{analysis.model}  ")
    out.append(f"> **生成时间**：{datetime.now().strftime('%Y-%m-%d %H:%M')}  ")
    out += ["", "---", ""]

    for key, value in parsed.items():
        if str(key).startswith("_"):
            continue
        out.append(f"## {_label(str(key))}")
        out.append("")
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    parts = " · ".join(f"**{_label(str(k))}**: {v}" for k, v in item.items())
                    out.append(f"- {parts}")
                else:
                    out.append(f"- {item}")
            out.append("")
        elif isinstance(value, dict):
            for k, v in value.items():
                out.append(f"- **{_label(str(k))}**: {v}")
            out.append("")
        else:
            out.append(str(value))
            out.append("")
    return "\n".join(out)
