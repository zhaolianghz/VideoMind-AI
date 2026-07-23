"""应用偏好设置 API（转录默认模型/语言等）。"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ...db.session import get_session
from ...models.setting import AppSetting

router = APIRouter()

# 允许的偏好键（防随意写入）
ALLOWED_KEYS = {
    "transcribe_model",
    "transcribe_language",
    "media_dir",   # 自定义媒体存储目录（空 = 默认 data_dir/media）
    "report_dir",  # 自定义报告导出目录（空 = 默认 ~/Downloads）
}


class PreferencesUpdate(BaseModel):
    transcribe_model: str | None = None      # auto/tiny/base/small/medium/large-v3
    transcribe_language: str | None = None   # auto/zh/en
    media_dir: str | None = None             # 自定义媒体存储目录（空 = 默认）
    report_dir: str | None = None            # 自定义报告导出目录（空 = 默认）


def get_setting(session: Session, key: str, default: str = "") -> str:
    row = session.get(AppSetting, key)
    return row.value if row else default


@router.get("")
def get_preferences(session: Session = Depends(get_session)) -> dict:
    rows = session.exec(select(AppSetting)).all()
    out = {k: "" for k in ALLOWED_KEYS}
    out.update({r.key: r.value for r in rows if r.key in ALLOWED_KEYS})
    return out


@router.put("")
def put_preferences(
    req: PreferencesUpdate, session: Session = Depends(get_session)
) -> dict:
    for key, value in req.model_dump(exclude_none=True).items():
        if key not in ALLOWED_KEYS:
            continue
        row = session.get(AppSetting, key)
        if row:
            row.value = value
        else:
            row = AppSetting(key=key, value=value)
        session.add(row)
    session.commit()
    return get_preferences(session)
