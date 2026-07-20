"""v1 API 路由聚合。"""
from fastapi import APIRouter

from .analyses import router as analyses_router
from .cookies import router as cookies_router
from .creators import router as creators_router
from .preferences import router as preferences_router
from .providers import router as providers_router
from .reports import router as reports_router
from .system import router as system_router
from .media import router as media_router
from .transcripts import router as transcripts_router
from .videos import router as videos_router

api_router = APIRouter()
api_router.include_router(system_router, prefix="/system", tags=["system"])
api_router.include_router(
    providers_router, prefix="/settings/providers", tags=["providers"]
)
api_router.include_router(cookies_router, prefix="/settings/cookies", tags=["cookies"])
api_router.include_router(
    preferences_router, prefix="/settings/preferences", tags=["preferences"]
)
api_router.include_router(videos_router, prefix="/videos", tags=["videos"])
api_router.include_router(media_router, prefix="/media", tags=["media"])
api_router.include_router(creators_router, prefix="/creators", tags=["creators"])
api_router.include_router(transcripts_router, prefix="/transcripts", tags=["transcripts"])
api_router.include_router(analyses_router, prefix="/analyses", tags=["analyses"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
