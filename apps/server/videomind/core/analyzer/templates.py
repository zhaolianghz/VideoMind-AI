"""分析模板：每个模板 = system(含 JSON 样例) + user(Jinja2) + 输出 schema。

system 里的 JSON 样例同时供真实 LLM 参考格式、供 FakeProvider 解析填充（用于无 key 测试）。
"""
import re as _re
from dataclasses import dataclass
from typing import Annotated

from pydantic import BaseModel, BeforeValidator

COMMON = "严格只输出 JSON 对象，不要任何解释文字或 markdown 代码块。"


# ── LLM 输出容错：模型常把数组写成字符串、把字符串写成数组/对象 ──
def _to_str_list(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return []
        return [p.strip() for p in _re.split(r"[；;、\n]+", v) if p.strip()]
    if isinstance(v, list):
        out: list[str] = []
        for item in v:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict):
                out.append("；".join(str(x) for x in item.values() if x))
            else:
                out.append(str(item))
        return [s for s in out if s]
    return [str(v)]


def _to_str(v) -> str:
    if v is None:
        return ""
    if isinstance(v, list):
        return "；".join(_to_str(x) for x in v if x)
    if isinstance(v, dict):
        return "；".join(f"{k}：{val}" for k, val in v.items() if val)
    return str(v)


StrList = Annotated[list[str], BeforeValidator(_to_str_list)]
FlexStr = Annotated[str, BeforeValidator(_to_str)]


# ── 输出 schema ──
class SummarySchema(BaseModel):
    summary: FlexStr


class KeypointItem(BaseModel):
    point: FlexStr
    evidence: FlexStr = ""


class KeypointsSchema(BaseModel):
    keypoints: list[KeypointItem]


class BusinessSchema(BaseModel):
    target_users: FlexStr
    monetization: StrList
    growth_strategy: FlexStr
    competitive_edge: FlexStr
    risks: StrList
    opportunities: StrList


class CourseChapter(BaseModel):
    chapter: FlexStr
    topics: StrList


class CourseSchema(BaseModel):
    outline: list[CourseChapter]
    knowledge_points: StrList
    cases: StrList
    target_audience: FlexStr


class ViralSchema(BaseModel):
    title_patterns: FlexStr
    hook_analysis: FlexStr
    content_structure: FlexStr
    spread_mechanism: FlexStr
    replication_model: FlexStr


class CreatorProfileSchema(BaseModel):
    positioning: FlexStr         # 账号定位/人设
    topic_patterns: StrList      # 选题规律
    content_formula: FlexStr     # 内容公式/结构套路
    audience: FlexStr            # 目标受众画像
    monetization: StrList        # 变现方式
    strengths: StrList           # 值得学习的优点
    replicable_tactics: StrList  # 可复制的具体策略


# 固定枚举利于 Library 筛选聚合；LLM 输出不在列表内时归入"其他"
CATEGORIES = (
    "知识科普", "课程教学", "商业财经", "科技数码", "带货营销",
    "娱乐剧情", "生活方式", "访谈播客", "新闻资讯", "其他",
)


def _to_category(v) -> str:
    s = _to_str(v).strip()
    return s if s in CATEGORIES else "其他"


CategoryStr = Annotated[str, BeforeValidator(_to_category)]


class ClassifySchema(BaseModel):
    category: CategoryStr
    tags: StrList       # 3-5 个自由标签
    reason: FlexStr     # 一句话判断依据


# ── 爆款五维评分：0-10 整数钳制 + 总分服务端计算（不信 LLM 的加法）──
def _to_score10(v) -> int:
    try:
        n = int(float(_to_str(v) or 0))
    except (ValueError, TypeError):
        n = 0
    return max(0, min(10, n))


Score10 = Annotated[int, BeforeValidator(_to_score10)]


class ScoreSchema(BaseModel):
    emotion: Score10      # 情绪分
    conflict: Score10     # 冲突分
    tension: Score10      # 张力分
    info_gap: Score10     # 信息差分
    resonance: Score10    # 共鸣分
    total: int = 0        # 总分（服务端求和，忽略 LLM 输出）
    summary: FlexStr      # 内容摘要
    rationale: FlexStr = ""  # 评分依据（一段话）

    def model_post_init(self, __context) -> None:
        self.total = (
            self.emotion + self.conflict + self.tension
            + self.info_gap + self.resonance
        )


class CommentsSchema(BaseModel):
    """用户洞察（评论分析）。"""
    audience_voice: FlexStr          # 评论区整体风向一句话
    needs_ranking: StrList           # 用户需求排行（频率×点赞加权）
    pain_points: StrList             # 痛点地图
    top_questions: StrList           # 高频问题
    objections: StrList              # 反对与质疑
    content_opportunities: StrList   # 下一条视频的内容机会


class ScriptItem(BaseModel):
    style: FlexStr
    script: FlexStr


class RecreateSchema(BaseModel):
    """二创生成（爆款复制）。"""
    formula: FlexStr             # 爆款公式
    content_template: FlexStr    # 可套用的内容模板
    transfer_directions: StrList # 10 个行业迁移方向
    new_topics: StrList          # 20 个新选题
    scripts: list[ScriptItem]    # 5 个不同风格脚本


@dataclass
class TemplateDef:
    name: str
    title: str
    system: str
    user: str
    schema: type[BaseModel]


TEMPLATES: dict[str, TemplateDef] = {
    "summary": TemplateDef(
        name="summary",
        title="视频摘要",
        system=(
            "你是视频内容分析助手。用 300 字以内中文概括视频主要内容。\n"
            '输出 JSON 结构：{"summary":""}\n' + COMMON
        ),
        user="视频转录文本：\n{{ transcript }}",
        schema=SummarySchema,
    ),
    "keypoints": TemplateDef(
        name="keypoints",
        title="核心观点",
        system=(
            "你是视频内容分析助手。提炼 3-5 个核心观点及支撑论据。\n"
            '输出 JSON 结构：{"keypoints":[{"point":"","evidence":""}]}\n' + COMMON
        ),
        user="视频转录文本：\n{{ transcript }}",
        schema=KeypointsSchema,
    ),
    "business": TemplateDef(
        name="business",
        title="商业模式分析",
        system=(
            "你是资深商业分析师。基于视频内容分析其商业模式。\n"
            "输出 JSON 结构（字段必填；monetization/risks/opportunities 必须是字符串数组）：\n"
            '{"target_users":"","monetization":["方式1","方式2"],"growth_strategy":"",'
            '"competitive_edge":"","risks":["风险1"],"opportunities":["机会1"]}\n' + COMMON
        ),
        user="视频转录文本：\n{{ transcript }}",
        schema=BusinessSchema,
    ),
    "course": TemplateDef(
        name="course",
        title="课程拆解分析",
        system=(
            "你是课程设计专家。拆解视频的教学逻辑与知识点。\n"
            "输出 JSON 结构：\n"
            '{"outline":[{"chapter":"","topics":[""]}],"knowledge_points":[""],'
            '"cases":[""],"target_audience":""}\n' + COMMON
        ),
        user="视频转录文本：\n{{ transcript }}",
        schema=CourseSchema,
    ),
    "viral": TemplateDef(
        name="viral",
        title="爆款规律分析",
        system=(
            "你是短视频爆款研究专家。分析视频的传播规律与可复制模型。\n"
            "输出 JSON 结构：\n"
            '{"title_patterns":"","hook_analysis":"","content_structure":"",'
            '"spread_mechanism":"","replication_model":""}\n' + COMMON
        ),
        user="视频转录文本：\n{{ transcript }}",
        schema=ViralSchema,
    ),
    "creator_profile": TemplateDef(
        name="creator_profile",
        title="博主画像分析",
        system=(
            "你是内容策略研究专家。以下是同一博主多条视频的摘要合集，"
            "请从整体上分析该账号的内容策略。\n"
            "输出 JSON 结构（数组字段必须是字符串数组）：\n"
            '{"positioning":"","topic_patterns":["规律1"],"content_formula":"",'
            '"audience":"","monetization":["方式1"],"strengths":["优点1"],'
            '"replicable_tactics":["策略1"]}\n' + COMMON
        ),
        # 博主级模板的输入是多视频摘要合集（由 run_creator_analyze 拼装），
        # 复用 transcript 变量名以兼容 run_analysis 的渲染逻辑
        user="博主视频摘要合集：\n{{ transcript }}",
        schema=CreatorProfileSchema,
    ),
    "classify": TemplateDef(
        name="classify",
        title="内容分类",
        system=(
            "你是视频内容分类助手。给视频归类并打标签。\n"
            f"category 必须从以下列表中选择一个：{'、'.join(CATEGORIES)}\n"
            "tags 为 3-5 个具体的自由标签（如“家常菜”“Python”“职场干货”）。\n"
            '输出 JSON 结构：{"category":"","tags":["标签1"],"reason":""}\n' + COMMON
        ),
        user="视频转录文本：\n{{ transcript }}",
        schema=ClassifySchema,
    ),
    "score": TemplateDef(
        name="score",
        title="爆款五维评分",
        system=(
            "你是拥有 10 年经验的短视频内容评审专家，参与过数千条爆款视频的复盘。"
            "请按以下专业评分标准对视频口播内容打分（每维 0-10 整数，宁严勿松）：\n"
            "【情绪分】内容唤起的情绪强度。0-3 平铺直叙无情绪起伏；4-6 有明确情绪点但强度一般；"
            "7-8 情绪浓烈（愤怒/惊喜/焦虑/感动之一贯穿）；9-10 多种强情绪叠加且有节奏推进。\n"
            "【冲突分】观点或情节的对抗性。0-3 无冲突；4-6 有常规对比（好vs坏）；"
            "7-8 有反常识观点或立场对立；9-10 直接挑战主流认知且论证有力。\n"
            "【张力分】叙事悬念与节奏。0-3 平淡流水账；4-6 有铺垫但节奏松散；"
            "7-8 开头 3 秒有钩子且层层递进；9-10 全程无废话、反转/悬念密集。\n"
            "【信息差分】提供的稀缺信息量。0-3 全是常识；4-6 有一定干货但可轻易搜到；"
            "7-8 有内部视角/一手数据/独家方法；9-10 显著认知升级、听完想立即记笔记。\n"
            "【共鸣分】目标人群的代入感。0-3 与观众无关；4-6 场景可代入但泛化；"
            "7-8 精准戳中某类人群的痛点/爽点；9-10 让人产生“这就是在说我”的强代入。\n"
            "summary 为 200 字以内的内容摘要；rationale 用一段话给出各维评分依据。\n"
            "不要输出 total（由系统计算）。\n"
            '输出 JSON 结构：{"emotion":0,"conflict":0,"tension":0,"info_gap":0,'
            '"resonance":0,"summary":"","rationale":""}\n' + COMMON
        ),
        user="视频转录文本：\n{{ transcript }}",
        schema=ScoreSchema,
    ),
    "comments": TemplateDef(
        name="comments",
        title="用户洞察(评论)",
        system=(
            "你是资深用户研究专家。以下是一条视频的真实用户评论，每行格式为"
            "「[赞N] 作者: 内容」，点赞越高代表越多人认同，权重越大。\n"
            "请挖掘真实用户需求（引用评论原话作为依据，不要臆测）：\n"
            "audience_voice 一句话概括评论区整体风向与情绪；\n"
            "needs_ranking 按提及频率×点赞加权排出用户需求 Top5-8（每条注明依据）；\n"
            "pain_points 用户痛点地图；top_questions 高频问题；\n"
            "objections 用户反对/质疑的点；\n"
            "content_opportunities 基于以上给出 5-10 个下一条视频的选题机会。\n"
            '输出 JSON 结构：{"audience_voice":"","needs_ranking":["需求1"],'
            '"pain_points":["痛点1"],"top_questions":["问题1"],"objections":["质疑1"],'
            '"content_opportunities":["机会1"]}\n' + COMMON
        ),
        user="视频评论列表：\n{{ transcript }}",
        schema=CommentsSchema,
    ),
    "recreate": TemplateDef(
        name="recreate",
        title="二创生成",
        system=(
            "你是短视频爆款复制专家。基于口播稿（以及可能附带的已有分析结论），"
            "提取底层爆款逻辑并生成二创方案。不要复制表面内容，避免简单改写，"
            "保持传播逻辑一致。\n"
            "formula 爆款公式（一句话可复述）；\n"
            "content_template 可直接套用的内容模板（含段落结构与各段时长配比）；\n"
            "transfer_directions 10 个不同行业的迁移方向；\n"
            "new_topics 20 个保持同一传播逻辑的新选题；\n"
            "scripts 5 个不同风格的完整口播脚本（style 风格名，script 脚本全文 200-400 字）。\n"
            '输出 JSON 结构：{"formula":"","content_template":"",'
            '"transfer_directions":["方向1"],"new_topics":["选题1"],'
            '"scripts":[{"style":"","script":""}]}\n' + COMMON
        ),
        user="参考材料：\n{{ transcript }}",
        schema=RecreateSchema,
    ),
}

PARTIAL_SYSTEM = (
    "你是视频内容分析助手。这是长视频的一个片段，请详细提取其中的人物、观点、数据、"
    "案例等关键信息，用结构化中文要点输出，保留细节供后续合并归纳。"
)
