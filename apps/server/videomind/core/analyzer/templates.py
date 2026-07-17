"""分析模板：每个模板 = system(含 JSON 样例) + user(Jinja2) + 输出 schema。

system 里的 JSON 样例同时供真实 LLM 参考格式、供 FakeProvider 解析填充（用于无 key 测试）。
"""
from dataclasses import dataclass

from pydantic import BaseModel

COMMON = "严格只输出 JSON 对象，不要任何解释文字或 markdown 代码块。"


# ── 输出 schema ──
class SummarySchema(BaseModel):
    summary: str


class KeypointItem(BaseModel):
    point: str
    evidence: str


class KeypointsSchema(BaseModel):
    keypoints: list[KeypointItem]


class BusinessSchema(BaseModel):
    target_users: str
    monetization: list[str]
    growth_strategy: str
    competitive_edge: str
    risks: list[str]
    opportunities: list[str]


class CourseChapter(BaseModel):
    chapter: str
    topics: list[str]


class CourseSchema(BaseModel):
    outline: list[CourseChapter]
    knowledge_points: list[str]
    cases: list[str]
    target_audience: str


class ViralSchema(BaseModel):
    title_patterns: str
    hook_analysis: str
    content_structure: str
    spread_mechanism: str
    replication_model: str


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
            "输出 JSON 结构（字段必填）：\n"
            '{"target_users":"","monetization":[""],"growth_strategy":"",'
            '"competitive_edge":"","risks":[""],"opportunities":[""]}\n' + COMMON
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
}

PARTIAL_SYSTEM = (
    "你是视频内容分析助手。这是长视频的一个片段，请详细提取其中的人物、观点、数据、"
    "案例等关键信息，用结构化中文要点输出，保留细节供后续合并归纳。"
)
