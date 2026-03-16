import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import health, websocket
from config import ALLOWED_ORIGINS, PORT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title="SignSpeak Live API",
    description="Real-time sign language interpreter backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(websocket.router)


@app.get("/voices")
async def get_voices():
    from services.tts_service import TTSService

    tts = TTSService()
    return {"voices": tts.get_available_voices()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
