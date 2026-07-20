"""深度拆解（15 维）：4 个子 Agent 并行分析 → 合并 → 爆款指数加权计算。

架构：
  内容定位/结构 Agent ─┐
  钩子/心理 Agent     ├─ 并行 → 合并 JSON → 代码计算爆款指数（不信 LLM 加权）
  传播/商业 Agent     │
  复制/生成 Agent    ─┘
爆款指数 = 开头吸引力30% + 内容价值25% + 情绪驱动20% + 互动设计15% + 商业价值10%
"""
import json
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Annotated

from pydantic import BaseModel, BeforeValidator

from .analyzer import AnalysisOutcome, _chat_json, _lang_hint
from .providers.base import BaseLLMProvider, Message
from .templates import COMMON, FlexStr, Score10, StrList


def _to_score100(v) -> int:
    try:
        n = int(float(str(v).strip() or 0))
    except (ValueError, TypeError):
        n = 0
    return max(0, min(100, n))


Score100 = Annotated[int, BeforeValidator(_to_score100)]

# 转录文本注入上限（4 个 Agent 各自全量注入，超长截断保开销可控）
MAX_TRANSCRIPT = 15000


class TimelineSeg(BaseModel):
    seg: FlexStr   # 时间段，如 "0-3秒"
    role: FlexStr  # 该段作用


class PositioningOut(BaseModel):
    """维度 1/4/9/11：核心定位、内容结构、用户画像、账号定位。"""
    content_type: FlexStr
    target_users: FlexStr
    core_need: FlexStr
    value_prop: FlexStr
    timeline: list[TimelineSeg]
    structure_pattern: FlexStr
    audience_age: FlexStr
    audience_job: FlexStr
    audience_needs: FlexStr
    audience_pains: FlexStr
    audience_buying_power: FlexStr
    audience_decision: FlexStr
    account_tags: StrList
    account_perception: FlexStr


class HookOut(BaseModel):
    """维度 2/3/5/6：黄金3秒、标题、用户心理、情绪。"""
    hook_text: FlexStr
    hook_type: FlexStr        # 痛点/利益/冲突/疑问/故事/数据/权威
    hook_mechanism: FlexStr
    hook_why: FlexStr
    hook_advice: FlexStr
    hook_score: Score100      # 开头吸引力（权重 30%）
    title_score: Score100
    title_pros: StrList
    title_cons: StrList
    title_better: StrList     # 5 个更强标题
    psychology_main: FlexStr
    psychology_secondary: FlexStr
    psychology_triggers: StrList
    anger: Score10
    anxiety: Score10
    surprise: Score10
    expectation: Score10
    trust: Score10
    resonance: Score10
    emotion_main: FlexStr
    emotion_why: FlexStr
    emotion_score: Score100   # 情绪驱动（权重 20%）


class GrowthOut(BaseModel):
    """维度 7/8/10：爆款因素、互动设计、商业价值。"""
    content_value: FlexStr
    emotion_value: FlexStr
    info_value: FlexStr
    entertain_value: FlexStr
    social_value: FlexStr
    content_score: Score100       # 内容价值（权重 25%）
    interaction_mechanisms: StrList
    interaction_suggestions: StrList
    interaction_score: Score100   # 互动设计（权重 15%）
    business_analysis: FlexStr
    business_models: StrList
    business_score: Score100      # 商业价值（权重 10%）


class ReplicateOut(BaseModel):
    """维度 12/13/14：复制模型、改进建议、同类选题。"""
    formula: FlexStr
    structure_template: FlexStr
    hook_pattern: FlexStr
    expression: FlexStr
    emotion_design: FlexStr
    improvements: StrList
    topics: StrList  # 20 个同类型爆款选题


_ROLE = (
    "你是顶级短视频内容策略专家，拥有 10 年以上抖音/快手/小红书/YouTube 内容运营经验，"
    "曾操盘多个账号从 0 到百万粉、打造过多条千万播放爆款。"
    "你的任务不是总结视频，而是回答：为什么它能传播、用户为什么停留、为什么互动、如何复制。"
    "只基于给到的字幕与数据分析，字幕不支持的判断明确说“依据不足”，不要编造画面/音效细节。"
    "拒绝泛泛而谈，每条都要具体可执行。"
)

_AGENTS: list[tuple[str, type[BaseModel], str]] = [
    (
        "positioning",
        PositioningOut,
        "请完成 4 个维度：\n"
        "1. 核心定位：内容类型、目标用户、解决的核心需求、价值主张\n"
        "2. 内容结构：按时间轴划分段落及各段作用（结合字幕时间戳），"
        "并判断结构模式（痛点→解决方案 / 故事→价值 / 冲突→观点 / 问题→答案 / 案例→方法）\n"
        "3. 用户画像：年龄、职业、需求、痛点、购买力、决策因素\n"
        "4. 账号定位：这条视频体现的人设/专业领域标签、希望建立的用户认知\n"
        '输出 JSON 结构：{"content_type":"","target_users":"","core_need":"","value_prop":"",'
        '"timeline":[{"seg":"0-3秒","role":""}],"structure_pattern":"",'
        '"audience_age":"","audience_job":"","audience_needs":"","audience_pains":"",'
        '"audience_buying_power":"","audience_decision":"",'
        '"account_tags":["标签1"],"account_perception":""}',
    ),
    (
        "hook",
        HookOut,
        "请完成 4 个维度：\n"
        "1. 黄金3秒：开头原文（引用字幕）、钩子类型（痛点/利益/冲突/疑问/故事/数据/权威）、"
        "注意力机制、有效原因、优化建议、开头吸引力评分 0-100（宁严勿松）\n"
        "2. 标题：按好奇心/利益诱惑/情绪刺激/信息差/用户相关性评分 0-100，"
        "列优点缺点，并生成 5 个更强标题\n"
        "3. 用户心理：从好奇/恐惧/损失厌恶/获利/身份认同/群体归属/情绪释放中判断主要与次要心理、触发点\n"
        "4. 情绪：愤怒/焦虑/惊喜/期待/信任/共鸣各 0-10 分，主要情绪及原因，情绪驱动力总评 0-100\n"
        '输出 JSON 结构：{"hook_text":"","hook_type":"","hook_mechanism":"","hook_why":"",'
        '"hook_advice":"","hook_score":0,"title_score":0,"title_pros":["优点"],"title_cons":["缺点"],'
        '"title_better":["标题1"],"psychology_main":"","psychology_secondary":"",'
        '"psychology_triggers":["触发点"],"anger":0,"anxiety":0,"surprise":0,"expectation":0,'
        '"trust":0,"resonance":0,"emotion_main":"","emotion_why":"","emotion_score":0}',
    ),
    (
        "growth",
        GrowthOut,
        "请完成 3 个维度：\n"
        "1. 爆款因素：分别分析内容价值/情绪价值/信息价值/娱乐价值/社交价值，"
        "给内容价值总评 0-100（结合提供的真实播放/点赞/评论数据判断，宁严勿松）\n"
        "2. 互动设计：视频里的评论诱导/转发理由/收藏价值/参与机制，给增强建议，互动设计评分 0-100\n"
        "3. 商业价值：引流能力、信任建立、产品植入空间、成交可能，适合的商业模式，商业价值评分 0-100\n"
        '输出 JSON 结构：{"content_value":"","emotion_value":"","info_value":"",'
        '"entertain_value":"","social_value":"","content_score":0,'
        '"interaction_mechanisms":["机制"],"interaction_suggestions":["建议"],"interaction_score":0,'
        '"business_analysis":"","business_models":["模式"],"business_score":0}',
    ),
    (
        "replicate",
        ReplicateOut,
        "请完成 3 个维度（提取底层逻辑，不是复制表面内容）：\n"
        "1. 复制模型：爆款公式、结构模板、开头套路、表达方式、情绪设计\n"
        "2. 改进建议：如果重新制作应优化的 3 点（具体可执行）\n"
        "3. 同类选题：保持底层逻辑一致，生成 20 个同类型爆款选题\n"
        '输出 JSON 结构：{"formula":"","structure_template":"","hook_pattern":"",'
        '"expression":"","emotion_design":"","improvements":["建议1"],"topics":["选题1"]}',
    ),
]


def _grade(total: int) -> str:
    if total >= 85:
        return "S"
    if total >= 70:
        return "A"
    if total >= 55:
        return "B"
    return "C"


def run_deep(
    meta: dict,
    transcript: str,
    provider: BaseLLMProvider,
    model: str,
    language: str = "zh",
    on_progress: Callable[[int], None] | None = None,
) -> AnalysisOutcome:
    """4 个子 Agent 并行 → 合并 → 计算爆款指数。meta 为视频元数据 dict。"""
    hint = _lang_hint(language)
    header = (
        f"视频标题：{meta.get('title', '')}\n"
        f"作者：{meta.get('author', '')}\n"
        f"时长：{meta.get('duration_sec', 0)} 秒\n"
        f"真实互动数据：播放 {meta.get('view_count', 0)} · 点赞 {meta.get('like_count', 0)}"
        f" · 评论 {meta.get('comment_count', 0)} · 分享 {meta.get('share_count', 0)}"
        f" · 收藏 {meta.get('favorite_count', 0)}\n"
    )
    if meta.get("comments_text"):
        header += f"\n热门评论（真实用户反馈，供判断共鸣与互动）：\n{meta['comments_text']}\n"
    header += f"\n视频字幕（含时间戳）：\n{transcript[:MAX_TRANSCRIPT]}"

    done = {"n": 0}

    def one(agent: tuple[str, type[BaseModel], str]) -> tuple[str, dict]:
        name, schema, task = agent
        messages = [
            Message("system", f"{_ROLE}\n{task}\n{hint}\n{COMMON}"),
            Message("user", header),
        ]
        parsed, _raw = _chat_json(provider, messages, model, schema)
        done["n"] += 1
        if on_progress:
            on_progress(int(done["n"] * 90 / len(_AGENTS)))
        return name, parsed

    with ThreadPoolExecutor(max_workers=len(_AGENTS)) as pool:
        results = dict(pool.map(one, _AGENTS))

    merged: dict = {}
    for part in results.values():
        merged.update(part)

    # 爆款指数：代码加权（开头30% + 内容25% + 情绪20% + 互动15% + 商业10%）
    total = round(
        merged.get("hook_score", 0) * 0.30
        + merged.get("content_score", 0) * 0.25
        + merged.get("emotion_score", 0) * 0.20
        + merged.get("interaction_score", 0) * 0.15
        + merged.get("business_score", 0) * 0.10
    )
    merged["viral_index"] = total
    merged["grade"] = _grade(total)

    if on_progress:
        on_progress(100)
    return AnalysisOutcome(
        parsed=merged,
        raw=json.dumps(merged, ensure_ascii=False),
        chunks=len(_AGENTS),
    )
