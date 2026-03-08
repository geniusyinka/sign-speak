from fastapi import APIRouter
from config import GEMINI_API_KEY
from services.tts_service import TTSService

router = APIRouter()
tts_service = TTSService()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "gemini_configured": bool(GEMINI_API_KEY),
        "tts_configured": tts_service.is_available(),
    }
