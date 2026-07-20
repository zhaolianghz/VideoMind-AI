"""模型服务商 CRUD（对齐 clawbox 设计）。"""
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...db.session import get_session
from ...models.provider import ModelProvider
from ...schemas.provider import (
    ProviderCreate,
    ProviderRead,
    ProviderTest,
    ProviderTestResult,
    ProviderUpdate,
)

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/test", response_model=ProviderTestResult)
def test_provider(
    payload: ProviderTest, session: Session = Depends(get_session)
) -> ProviderTestResult:
    """真实调一次 chat 接口验证 Key/URL/模型可用。"""
    api_key = payload.api_key
    base_url = payload.base_url.rstrip("/")
    model = payload.model
    if payload.provider_id:
        obj = session.get(ModelProvider, payload.provider_id)
        if obj:
            api_key = api_key or obj.api_key
            base_url = base_url or obj.base_url.rstrip("/")
            model = model or obj.default_model
    if not base_url:
        return ProviderTestResult(success=False, message="Base URL 为空", latency_ms=0)

    body = {
        "model": model,
        "max_tokens": 8,
        "messages": [{"role": "user", "content": "ping"}],
    }
    if payload.kind == "anthropic":
        url = f"{base_url}/messages"
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        url = f"{base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}

    start = time.perf_counter()
    try:
        resp = httpx.post(url, headers=headers, json=body, timeout=20)
    except Exception as exc:  # noqa: BLE001 - 网络错误原样反馈给用户
        ms = int((time.perf_counter() - start) * 1000)
        return ProviderTestResult(success=False, message=f"连接失败：{exc}", latency_ms=ms)
    ms = int((time.perf_counter() - start) * 1000)
    if resp.status_code < 400:
        return ProviderTestResult(
            success=True, message=f"连接成功，{model} 可用", latency_ms=ms
        )
    try:
        detail = resp.json()
        err = detail.get("error", detail)
        msg = err.get("message") if isinstance(err, dict) else str(err)
    except Exception:  # noqa: BLE001
        msg = resp.text
    return ProviderTestResult(
        success=False,
        message=f"HTTP {resp.status_code}：{(msg or '')[:200]}",
        latency_ms=ms,
    )


@router.get("", response_model=list[ProviderRead])
def list_providers(session: Session = Depends(get_session)) -> list[ModelProvider]:
    return list(session.exec(select(ModelProvider)))


@router.post("", response_model=ProviderRead, status_code=201)
def create_provider(
    payload: ProviderCreate, session: Session = Depends(get_session)
) -> ModelProvider:
    obj = ModelProvider(**payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/{provider_id}", response_model=ProviderRead)
def get_provider(
    provider_id: str, session: Session = Depends(get_session)
) -> ModelProvider:
    obj = session.get(ModelProvider, provider_id)
    if not obj:
        raise HTTPException(status_code=404, detail="provider not found")
    return obj


@router.put("/{provider_id}", response_model=ProviderRead)
def update_provider(
    provider_id: str,
    payload: ProviderUpdate,
    session: Session = Depends(get_session),
) -> ModelProvider:
    obj = session.get(ModelProvider, provider_id)
    if not obj:
        raise HTTPException(status_code=404, detail="provider not found")
    data = payload.model_dump(exclude_unset=True)
    # api_key 留空 = 不修改
    if "api_key" in data and not data["api_key"]:
        data.pop("api_key")
    for key, value in data.items():
        setattr(obj, key, value)
    obj.updated_at = _utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{provider_id}", status_code=204)
def delete_provider(provider_id: str, session: Session = Depends(get_session)) -> None:
    obj = session.get(ModelProvider, provider_id)
    if not obj:
        raise HTTPException(status_code=404, detail="provider not found")
    session.delete(obj)
    session.commit()
