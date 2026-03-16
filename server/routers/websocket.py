from __future__ import annotations

import asyncio
import base64
import logging
import time
import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.gemini_service import GeminiService
from services.room_service import RoomService
from services.tts_service import TTSService
from services.session_service import SessionService

logger = logging.getLogger(__name__)

router = APIRouter()

gemini_service = GeminiService()
tts_service = TTSService()
session_service = SessionService()
room_service = RoomService()

AUDIO_DEBOUNCE_MS = 500
AUDIO_MAX_WINDOW_MS = 1800


def _normalize_room_id(raw_room_id: str | None) -> str | None:
    if not raw_room_id:
        return None
    room_id = "".join(ch for ch in raw_room_id.upper() if ch.isalnum())[:8]
    return room_id or None


async def _send_room_state(room_id: str) -> None:
    await room_service.broadcast(
        room_id,
        {
            "type": "room_state",
            "roomId": room_id,
            "participantCount": room_service.get_participant_count(room_id),
            "participants": room_service.get_participants(room_id),
        },
    )


@router.websocket("/ws/conversation")
async def conversation_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")

    room_id = _normalize_room_id(websocket.query_params.get("room_id"))
    participant_id = websocket.query_params.get("participant_id") or str(uuid.uuid4())
    participant_name = (websocket.query_params.get("participant_name") or "Guest").strip()[:40] or "Guest"
    is_room_session = room_id is not None

    if is_room_session:
        participant = await room_service.join_room(
            room_id=room_id,
            participant_id=participant_id,
            participant_name=participant_name,
            websocket=websocket,
        )
        session_id = participant.connection_id
        await websocket.send_json({
            "type": "room_state",
            "roomId": room_id,
            "participantId": participant_id,
            "participantName": participant_name,
            "participantCount": room_service.get_participant_count(room_id),
            "participants": room_service.get_participants(room_id),
        })
        await _send_room_state(room_id)
    else:
        session_data = session_service.create_session()
        session_id = session_data.session_id

    await websocket.send_json({"type": "status", "status": "ready"})

    # Frame buffer for batching sign recognition
    frame_buffer: list[bytes] = []
    frame_lock = asyncio.Lock()
    processing = False

    # Audio buffer for speech-to-text
    audio_buffer: list[bytes] = []
    audio_lock = asyncio.Lock()
    audio_processing = False

    async def process_sign_frames():
        """Process buffered frames for sign recognition."""
        nonlocal processing
        if processing:
            return
        processing = True

        try:
            async with frame_lock:
                if not frame_buffer:
                    processing = False
                    return
                frames = list(frame_buffer)
                frame_buffer.clear()
            started_at = time.perf_counter()

            await websocket.send_json({"type": "status", "status": "processing"})
            if is_room_session and room_id:
                room_service.set_activity(room_id, session_id, "processing")
                await _send_room_state(room_id)
            await websocket.send_json({
                "type": "debug",
                "message": f"Processing {len(frames)} frame(s)...",
            })

            history = room_service.get_history(room_id) if is_room_session and room_id else session_service.get_history(session_id)

            if len(frames) < 4:
                await websocket.send_json({
                    "type": "debug",
                    "message": f"Insufficient signing context ({len(frames)} frame(s)); record a slightly longer sign before interpreting",
                })
                text = "[idle]"
            else:
                # Use the whole buffered clip for sign recognition accuracy
                await websocket.send_json({
                    "type": "debug",
                    "message": f"Batch recognition with {len(frames)} frames (~{len(frames)/8:.1f}s of video)",
                })
                text = await gemini_service.recognize_sign_batch(frames, history)
                text = text.strip()

            await websocket.send_json({
                "type": "debug",
                "message": f"Gemini response: \"{text}\"",
            })
            await websocket.send_json({
                "type": "debug",
                "message": f"Sign recognition latency: {(time.perf_counter() - started_at):.2f}s",
            })

            if text and text not in ("[unclear]", "[idle]") and len(text) > 0:
                payload = {
                    "type": "translation",
                    "text": text,
                    "source": "signed",
                    "participantId": participant_id if is_room_session else None,
                    "participantName": participant_name if is_room_session else None,
                    "roomId": room_id,
                }

                if is_room_session and room_id:
                    room_service.add_message(
                        room_id,
                        "signed",
                        text,
                        "user",
                        participant_id,
                        participant_name,
                    )
                    await room_service.broadcast(room_id, payload)
                else:
                    session_service.add_message(session_id, "signed", text, "user")
                    await websocket.send_json(payload)

                # Generate TTS audio
                if not is_room_session and tts_service.is_available():
                    try:
                        audio_data = await tts_service.synthesize(text)
                        if audio_data:
                            audio_b64 = base64.b64encode(audio_data).decode()
                            await websocket.send_json({
                                "type": "audio",
                                "data": audio_b64,
                            })
                    except Exception as e:
                        logger.error(f"TTS failed: {e}")
                        await websocket.send_json({
                            "type": "debug",
                            "message": "Server TTS unavailable, using browser speech fallback",
                        })

            await websocket.send_json({"type": "status", "status": "ready"})
            if is_room_session and room_id:
                room_service.set_activity(room_id, session_id, "idle")
                await _send_room_state(room_id)
        except Exception as e:
            logger.error(f"Sign recognition error: {e}")
            await websocket.send_json({
                "type": "debug",
                "message": f"Error: {str(e)[:150]}",
            })
            await websocket.send_json({
                "type": "error",
                "error": f"Recognition failed: {str(e)[:100]}",
            })
        finally:
            processing = False

    async def process_audio_chunks():
        """Process buffered audio chunks for speech-to-text transcription."""
        nonlocal audio_processing
        if audio_processing:
            return
        audio_processing = True

        try:
            async with audio_lock:
                if not audio_buffer:
                    audio_processing = False
                    return
                combined = b"".join(audio_buffer)
                audio_buffer.clear()

            # Need minimum audio length (~0.5s at 16kHz 16-bit mono = 16000 bytes)
            if len(combined) < 16000:
                audio_processing = False
                return

            await websocket.send_json({"type": "status", "status": "processing"})
            if is_room_session and room_id:
                room_service.set_activity(room_id, session_id, "processing")
                await _send_room_state(room_id)

            history = room_service.get_history(room_id) if is_room_session and room_id else session_service.get_history(session_id)
            text = await gemini_service.transcribe_audio(combined, history)
            text = text.strip()

            if text and text != "[silent]" and len(text) > 0:
                gloss = await gemini_service.spoken_text_to_asl_gloss(text, history)
                if gloss == "[skip]":
                    gloss = ""
                payload = {
                    "type": "translation",
                    "text": text,
                    "source": "spoken",
                    "participantId": participant_id if is_room_session else None,
                    "participantName": participant_name if is_room_session else None,
                    "roomId": room_id,
                    "gloss": gloss or None,
                }

                if is_room_session and room_id:
                    room_service.add_message(
                        room_id,
                        "spoken",
                        text,
                        "other",
                        participant_id,
                        participant_name,
                        gloss=gloss or None,
                    )
                    await room_service.broadcast(room_id, payload)
                else:
                    session_service.add_message(session_id, "spoken", text, "other", gloss=gloss or None)
                    await websocket.send_json(payload)

            await websocket.send_json({"type": "status", "status": "ready"})
            if is_room_session and room_id:
                room_service.set_activity(room_id, session_id, "idle")
                await _send_room_state(room_id)
        except Exception as e:
            logger.error(f"Audio transcription error: {e}")
            await websocket.send_json({
                "type": "error",
                "error": f"Transcription failed: {str(e)[:100]}",
            })
        finally:
            audio_processing = False

    # Debounce timer for audio processing
    audio_debounce_task: Optional[asyncio.Task] = None
    audio_window_task: Optional[asyncio.Task] = None

    async def debounce_audio():
        """Wait briefly after last audio chunk, then transcribe."""
        await asyncio.sleep(AUDIO_DEBOUNCE_MS / 1000)
        await process_audio_chunks()

    async def flush_audio_window():
        """Force a transcription chunk even if the speaker keeps talking."""
        await asyncio.sleep(AUDIO_MAX_WINDOW_MS / 1000)
        await process_audio_chunks()

    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")

            if msg_type == "video_frame":
                frame_data = base64.b64decode(message["data"])
                async with frame_lock:
                    frame_buffer.append(frame_data)
                    # Keep a longer rolling phrase clip for hands-up sentence capture
                    if len(frame_buffer) > 48:
                        frame_buffer.pop(0)
                    buffered_frames = len(frame_buffer)
                if is_room_session and room_id:
                    room_service.set_activity(room_id, session_id, "signing")
                    await _send_room_state(room_id)
                if buffered_frames in (1, 4, 8, 12, 16, 24, 32, 40, 48):
                    await websocket.send_json({
                        "type": "debug",
                        "message": f"Buffered sign frames: {buffered_frames}",
                    })

            elif msg_type == "audio_chunk":
                audio_data = base64.b64decode(message["data"])
                async with audio_lock:
                    audio_buffer.append(audio_data)
                if is_room_session and room_id:
                    room_service.set_activity(room_id, session_id, "speaking")
                    await _send_room_state(room_id)

                # Reset audio debounce timer
                if audio_debounce_task and not audio_debounce_task.done():
                    audio_debounce_task.cancel()
                audio_debounce_task = asyncio.create_task(debounce_audio())
                if audio_window_task is None or audio_window_task.done():
                    audio_window_task = asyncio.create_task(flush_audio_window())

            elif msg_type == "end_turn":
                # Force process any buffered frames/audio immediately
                if audio_debounce_task and not audio_debounce_task.done():
                    audio_debounce_task.cancel()
                if audio_window_task and not audio_window_task.done():
                    audio_window_task.cancel()
                await websocket.send_json({
                    "type": "debug",
                    "message": "End turn received; flushing sign/audio buffers",
                })
                await process_sign_frames()
                await process_audio_chunks()

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception:
            pass
    finally:
        if audio_debounce_task and not audio_debounce_task.done():
            audio_debounce_task.cancel()
        if audio_window_task and not audio_window_task.done():
            audio_window_task.cancel()
        if is_room_session and room_id:
            remaining = await room_service.leave_room(room_id, session_id)
            if remaining > 0:
                await _send_room_state(room_id)
        else:
            session_service.remove_session(session_id)
