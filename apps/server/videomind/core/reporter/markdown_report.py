"""将分析结果渲染为 Markdown 报告。"""
from datetime import datetime
from typing import Any

LABELS: dict[str, str] = {
    "summary": "摘要", "point": "观点", "evidence": "论据",
    "monetization": "盈利方式", "growth_strategy": "增长策略",
    "competitive_edge": "竞争优势", "risks": "风险", "opportunities": "机会",
    "chapter": "章节", "knowledge_points": "知识点列表",
    "cases": "案例", "target_audience": "适合人群",
    "title_patterns": "标题规律", "hook_analysis": "开头钩子分析", "content_structure": "内容结构",
    "spread_mechanism": "传播机制", "replication_model": "复制模型",
    "positioning": "账号定位", "topic_patterns": "选题规律", "content_formula": "内容公式",
    "audience": "受众画像", "strengths": "亮点", "replicable_tactics": "可复制策略",
    "category": "分类", "tags": "标签", "reason": "判断依据",
    "emotion": "情绪分", "conflict": "冲突分", "tension": "张力分",
    "info_gap": "信息差分", "resonance": "共鸣分", "total": "总分",
    "rationale": "评分依据",
    # 深度拆解
    "content_type": "内容类型", "target_users": "目标用户", "core_need": "核心需求",
    "value_prop": "价值主张", "timeline": "时间轴结构", "seg": "时间段", "role": "作用",
    "structure_pattern": "结构模式", "audience_age": "受众年龄", "audience_job": "受众职业",
    "audience_needs": "受众需求", "audience_pains": "受众痛点",
    "audience_buying_power": "购买力", "audience_decision": "决策因素",
    "account_tags": "账号标签", "account_perception": "用户认知",
    "hook_text": "开头原文", "hook_type": "钩子类型", "hook_mechanism": "注意力机制",
    "hook_why": "有效原因", "hook_advice": "开头优化建议", "hook_score": "开头吸引力分",
    "title_score": "标题评分", "title_pros": "标题优点", "title_cons": "标题缺点",
    "title_better": "更强标题", "psychology_main": "主要心理", "psychology_secondary": "次要心理",
    "psychology_triggers": "心理触发点", "anger": "愤怒", "anxiety": "焦虑", "surprise": "惊喜",
    "expectation": "期待", "trust": "信任", "emotion_main": "主要情绪", "emotion_why": "情绪解读",
    "emotion_score": "情绪驱动分", "content_value": "内容价值", "emotion_value": "情绪价值",
    "info_value": "信息价值", "entertain_value": "娱乐价值", "social_value": "社交价值",
    "content_score": "内容价值分", "interaction_mechanisms": "互动机制",
    "interaction_suggestions": "互动增强建议", "interaction_score": "互动设计分",
    "business_analysis": "商业价值分析", "business_models": "适合商业模式",
    "business_score": "商业价值分", "formula": "爆款公式", "structure_template": "结构模板",
    "hook_pattern": "开头套路", "expression": "表达方式", "emotion_design": "情绪设计",
    "improvements": "改进建议", "topics": "同类型选题",
    "viral_index": "爆款指数", "grade": "等级",
    "audience_voice": "评论区风向", "needs_ranking": "用户需求排行",
    "pain_points": "痛点地图", "top_questions": "高频问题", "objections": "反对与质疑",
    "content_opportunities": "内容机会",
    "content_template": "内容模板", "transfer_directions": "行业迁移方向",
    "new_topics": "新选题", "scripts": "风格脚本", "style": "风格", "script": "脚本",
}

TEMPLATE_LABELS: dict[str, str] = {
    "summary": "视频摘要", "keypoints": "核心观点", "business": "商业模式分析",
    "course": "课程拆解分析", "viral": "爆款规律分析", "creator_profile": "博主画像分析",
    "classify": "内容分类", "score": "爆款五维评分", "deep": "深度拆解(15维)", "comments": "用户洞察(评论)", "recreate": "二创生成",
}


def _label(key: str) -> str:
    return LABELS.get(key, key)


def render_markdown(
    video: Any, analysis: Any, parsed: dict, template_label: str,
    creator: Any = None,
) -> str:
    if creator is not None:
        title = f"{getattr(creator, 'name', '')} · 博主画像".strip(" ·")
    else:
        title = (getattr(video, "title", None) if video else None) or "视频分析报告"
    out: list[str] = [f"# {title}", ""]

    if creator is not None:
        out.append(f"> **博主**：{creator.name}  ")
        out.append(f"> **平台**：{creator.platform}  ")
        out.append(f"> **样本视频数**：{analysis.chunks}  ")
    elif video:
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
