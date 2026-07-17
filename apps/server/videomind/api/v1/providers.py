"""模型服务商 CRUD（对齐 clawbox 设计）。"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...db.session import get_session
from ...models.provider import ModelProvider
from ...schemas.provider import ProviderCreate, ProviderRead, ProviderUpdate

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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
