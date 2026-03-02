from __future__ import annotations

import uuid
import logging
from typing import Optional
from datetime import datetime
from models.session import SessionData
from models.messages import ConversationMessage

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(self):
        self._sessions: dict[str, SessionData] = {}

    def create_session(self) -> SessionData:
        """Create a new conversation session."""
        session_id = str(uuid.uuid4())
        session = SessionData(
            session_id=session_id,
            created_at=datetime.utcnow(),
        )
        self._sessions[session_id] = session
        logger.info(f"Created session: {session_id}")
        return session

    def get_session(self, session_id: str) -> Optional[SessionData]:
        """Get an existing session."""
        return self._sessions.get(session_id)

    def add_message(
        self,
        session_id: str,
        msg_type: str,
        text: str,
        speaker: str,
        confidence: Optional[float] = None,
    ) -> None:
        """Add a message to a session's conversation history."""
        session = self._sessions.get(session_id)
        if not session:
            return

        message = ConversationMessage(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            type=msg_type,
            text=text,
            speaker=speaker,
            confidence=confidence,
        )
        session.conversation_history.append(message)

    def get_history(self, session_id: str) -> list[dict]:
        """Get conversation history for context."""
        session = self._sessions.get(session_id)
        if not session:
            return []

        return [
            {"speaker": msg.speaker, "text": msg.text}
            for msg in session.conversation_history[-5:]
        ]

    def remove_session(self, session_id: str) -> None:
        """Remove a session."""
        self._sessions.pop(session_id, None)
        logger.info(f"Removed session: {session_id}")
