from fastapi import APIRouter
from config import GEMINI_API_KEY

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "gemini_configured": bool(GEMINI_API_KEY),
    }
