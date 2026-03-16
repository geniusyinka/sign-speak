from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fastapi import WebSocket

from models.messages import ConversationMessage

logger = logging.getLogger(__name__)


@dataclass
class ParticipantConnection:
    connection_id: str
    participant_id: str
    participant_name: str
    websocket: WebSocket
    activity: str = "idle"


@dataclass
class RoomData:
    room_id: str
    created_at: datetime
    conversation_history: list[ConversationMessage] = field(default_factory=list)
    participants: dict[str, ParticipantConnection] = field(default_factory=dict)


class RoomService:
    def __init__(self):
        self._rooms: dict[str, RoomData] = {}
        self._lock = asyncio.Lock()

    async def join_room(
        self,
        room_id: str,
        participant_id: str,
        participant_name: str,
        websocket: WebSocket,
    ) -> ParticipantConnection:
        connection = ParticipantConnection(
            connection_id=str(uuid.uuid4()),
            participant_id=participant_id,
            participant_name=participant_name,
            websocket=websocket,
        )

        async with self._lock:
            room = self._rooms.get(room_id)
            if room is None:
                room = RoomData(room_id=room_id, created_at=datetime.utcnow())
                self._rooms[room_id] = room
                logger.info("Created room: %s", room_id)

            room.participants[connection.connection_id] = connection

        return connection

    async def leave_room(self, room_id: str, connection_id: str) -> int:
        async with self._lock:
            room = self._rooms.get(room_id)
            if room is None:
                return 0

            room.participants.pop(connection_id, None)
            remaining = len(room.participants)
            if remaining == 0:
                self._rooms.pop(room_id, None)
                logger.info("Removed empty room: %s", room_id)
            return remaining

    def add_message(
        self,
        room_id: str,
        msg_type: str,
        text: str,
        speaker: str,
        participant_id: str,
        participant_name: str,
        confidence: float | None = None,
        gloss: str | None = None,
    ) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return

        message = ConversationMessage(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            type=msg_type,
            text=text,
            speaker=speaker,
            confidence=confidence,
            participant_id=participant_id,
            participant_name=participant_name,
            gloss=gloss,
        )
        room.conversation_history.append(message)

    def get_history(self, room_id: str) -> list[dict[str, str]]:
        room = self._rooms.get(room_id)
        if not room:
            return []

        return [
            {
                "speaker": msg.participant_name or msg.speaker,
                "text": msg.text,
            }
            for msg in room.conversation_history[-8:]
        ]

    def get_participant_count(self, room_id: str) -> int:
        room = self._rooms.get(room_id)
        return len(room.participants) if room else 0

    def set_activity(self, room_id: str, connection_id: str, activity: str) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        participant = room.participants.get(connection_id)
        if participant:
            participant.activity = activity

    def get_participants(self, room_id: str) -> list[dict[str, str]]:
        room = self._rooms.get(room_id)
        if not room:
            return []

        return [
            {
                "participantId": participant.participant_id,
                "participantName": participant.participant_name,
                "activity": participant.activity,
            }
            for participant in room.participants.values()
        ]

    async def broadcast(self, room_id: str, payload: dict[str, Any]) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return

        stale_connections: list[str] = []
        for connection_id, participant in room.participants.items():
            try:
                await participant.websocket.send_json(payload)
            except Exception:
                stale_connections.append(connection_id)

        for connection_id in stale_connections:
            await self.leave_room(room_id, connection_id)
