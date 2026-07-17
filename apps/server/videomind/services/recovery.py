"""启动恢复：服务重启时把残留的 processing 状态任务标记为可重试。

满足 PRD 5.2「任务队列异常中断后可恢复」——轻量替代 Celery 的崩溃恢复。
"""
from sqlmodel import Session, select

from ..db.session import engine
from ..models.analysis import Analysis
from ..models.video import Video

PROCESSING_STATUSES = ("collecting", "extracting", "transcribing", "running")


def recover_interrupted_tasks() -> dict[str, int]:
    """uvicorn 启动时调用。返回恢复计数。"""
    counts = {"videos": 0, "analyses": 0}
    with Session(engine) as s:
        for v in s.exec(
            select(Video).where(Video.status.in_(PROCESSING_STATUSES))
        ).all():
            v.status = "failed"
            v.error = "任务因服务重启中断，可重试"
            s.add(v)
            counts["videos"] += 1
        for a in s.exec(
            select(Analysis).where(Analysis.status.in_(PROCESSING_STATUSES))
        ).all():
            a.status = "failed"
            a.error = "分析因服务重启中断，可重试"
            s.add(a)
            counts["analyses"] += 1
        s.commit()
    return counts
