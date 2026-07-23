"""模型服务商 CRUD（对齐 clawbox 设计）。"""
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...db.session import get_session
from ...models.provider import ModelProvider
from ...schemas.provider import (
    ClawboxImportResult,
    ProviderCreate,
    ProviderRead,
    ProviderTest,
    ProviderTestResult,
    ProviderUpdate,
)

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _clear_default(session: Session, keep_id: str | None = None) -> None:
    """默认服务商全表唯一：置新默认前清掉其它记录的 is_default。"""
    for other in session.exec(
        select(ModelProvider).where(ModelProvider.is_default == True)  # noqa: E712
    ):
        if other.id != keep_id:
            other.is_default = False
            session.add(other)


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


@router.post("/import/clawbox", response_model=ClawboxImportResult)
def import_clawbox(session: Session = Depends(get_session)) -> ClawboxImportResult:
    """一键导入 ~/.clawbox/config.json 里的服务商，同名更新覆盖（幂等）。

    映射：优先 openaiBaseUrl → openai_compat；否则 anthropicBaseUrl → anthropic。
    两个 URL 都为空、或没有 name 的条目跳过。
    """
    cfg_path = Path.home() / ".clawbox" / "config.json"
    if not cfg_path.exists():
        raise HTTPException(status_code=404, detail="未找到 ~/.clawbox/config.json")
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"clawbox 配置读取失败：{exc}") from exc

    created = updated = skipped = 0
    name_by_clawbox_id: dict[str, str] = {}
    for entry in cfg.get("providers", []):
        if not isinstance(entry, dict):
            skipped += 1
            continue
        name = (entry.get("name") or "").strip()
        openai_url = (entry.get("openaiBaseUrl") or "").strip()
        anthropic_url = (entry.get("anthropicBaseUrl") or "").strip()
        if not name or not (openai_url or anthropic_url):
            skipped += 1
            continue
        if entry.get("id"):
            name_by_clawbox_id[str(entry["id"])] = name

        kind = "openai_compat" if openai_url else "anthropic"
        base_url = openai_url or anthropic_url
        models = [str(m) for m in (entry.get("models") or []) if m]
        default_model = (entry.get("defaultModel") or "").strip() or (
            models[0] if models else ""
        )
        api_key = entry.get("apiKey") or ""
        enabled = bool(entry.get("enabled", True))

        obj = session.exec(
            select(ModelProvider).where(ModelProvider.name == name)
        ).first()
        if obj:
            obj.kind = kind
            obj.base_url = base_url
            if api_key:  # clawbox 侧 Key 为空时保留已存 Key
                obj.api_key = api_key
            obj.default_model = default_model
            obj.models = models
            obj.enabled = enabled
            obj.updated_at = _utcnow()
            updated += 1
        else:
            obj = ModelProvider(
                name=name,
                kind=kind,
                base_url=base_url,
                api_key=api_key,
                default_model=default_model,
                models=models,
                enabled=enabled,
            )
            created += 1
        session.add(obj)
    session.flush()

    # clawbox 的活跃服务商 → 本地默认服务商（仅当本地还没有默认时，不覆盖用户选择）
    has_default = session.exec(
        select(ModelProvider).where(ModelProvider.is_default == True)  # noqa: E712
    ).first()
    active_name = name_by_clawbox_id.get(str(cfg.get("active_provider_id") or ""))
    if not has_default and active_name:
        active = session.exec(
            select(ModelProvider).where(ModelProvider.name == active_name)
        ).first()
        if active:
            active.is_default = True
            session.add(active)

    session.commit()
    return ClawboxImportResult(created=created, updated=updated, skipped=skipped)


@router.get("", response_model=list[ProviderRead])
def list_providers(session: Session = Depends(get_session)) -> list[ModelProvider]:
    return list(session.exec(select(ModelProvider)))


@router.post("", response_model=ProviderRead, status_code=201)
def create_provider(
    payload: ProviderCreate, session: Session = Depends(get_session)
) -> ModelProvider:
    obj = ModelProvider(**payload.model_dump())
    if obj.is_default:
        _clear_default(session)
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
    if data.get("is_default"):
        _clear_default(session, keep_id=obj.id)
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
