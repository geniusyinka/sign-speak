from pydantic import BaseModel
from datetime import datetime
from .messages import ConversationMessage


class SessionData(BaseModel):
    session_id: str
    created_at: datetime
    conversation_history: list[ConversationMessage] = []
