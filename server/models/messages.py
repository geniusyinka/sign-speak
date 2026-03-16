from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class WSMessage(BaseModel):
    type: Literal[
        "video_frame",
        "audio_chunk",
        "end_turn",
        "room_state",
        "translation",
        "audio",
        "error",
        "status",
    ]
    data: Optional[str] = None  # base64 encoded
    text: Optional[str] = None
    error: Optional[str] = None
    confidence: Optional[float] = None
    status: Optional[Literal["ready", "processing", "error"]] = None
    room_id: Optional[str] = None
    participant_id: Optional[str] = None
    participant_name: Optional[str] = None
    participant_count: Optional[int] = None
    gloss: Optional[str] = None


class ConversationMessage(BaseModel):
    id: str
    timestamp: datetime
    type: Literal["signed", "spoken"]
    text: str
    speaker: Literal["user", "other"]
    confidence: Optional[float] = None
    participant_id: Optional[str] = None
    participant_name: Optional[str] = None
    gloss: Optional[str] = None
