from __future__ import annotations

import asyncio
import base64
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.gemini_service import GeminiService
from services.tts_service import TTSService
from services.session_service import SessionService

logger = logging.getLogger(__name__)

router = APIRouter()

gemini_service = GeminiService()
tts_service = TTSService()
session_service = SessionService()


@router.websocket("/ws/conversation")
async def conversation_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")

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

            await websocket.send_json({"type": "status", "status": "processing"})
            await websocket.send_json({
                "type": "debug",
                "message": f"Processing {len(frames)} frame(s)...",
            })

            history = session_service.get_history(session_id)

            if len(frames) == 1:
                # Single frame - use streaming for fast response
                full_text = ""
                await websocket.send_json({
                    "type": "debug",
                    "message": "Single frame → streaming recognition",
                })
                async for chunk in gemini_service.recognize_sign(
                    frames[0], history
                ):
                    full_text += chunk
                    # Stream partial results to frontend for instant feedback
                    await websocket.send_json({
                        "type": "partial",
                        "text": full_text.strip(),
                    })

                text = full_text.strip()
            else:
                # Multiple frames - batch for better accuracy
                await websocket.send_json({
                    "type": "debug",
                    "message": f"Batch recognition with {len(frames)} frames (~{len(frames)/5:.1f}s of video)",
                })
                text = await gemini_service.recognize_sign_batch(frames, history)
                text = text.strip()

            await websocket.send_json({
                "type": "debug",
                "message": f"Gemini response: \"{text}\"",
            })

            if text and text not in ("[unclear]", "[idle]") and len(text) > 0:
                session_service.add_message(session_id, "signed", text, "user")

                await websocket.send_json({
                    "type": "translation",
                    "text": text,
                })

                # Generate TTS audio
                try:
                    audio_data = await tts_service.synthesize(text)
                    audio_b64 = base64.b64encode(audio_data).decode()
                    await websocket.send_json({
                        "type": "audio",
                        "data": audio_b64,
                    })
                except Exception as e:
                    logger.error(f"TTS failed: {e}")

            await websocket.send_json({"type": "status", "status": "ready"})
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

            history = session_service.get_history(session_id)
            text = await gemini_service.transcribe_audio(combined, history)
            text = text.strip()

            if text and text != "[silent]" and len(text) > 0:
                session_service.add_message(session_id, "spoken", text, "other")

                await websocket.send_json({
                    "type": "translation",
                    "text": text,
                })

            await websocket.send_json({"type": "status", "status": "ready"})
        except Exception as e:
            logger.error(f"Audio transcription error: {e}")
            await websocket.send_json({
                "type": "error",
                "error": f"Transcription failed: {str(e)[:100]}",
            })
        finally:
            audio_processing = False

    # Debounce timer for frame processing
    debounce_task: Optional[asyncio.Task] = None
    # Debounce timer for audio processing
    audio_debounce_task: Optional[asyncio.Task] = None

    async def debounce_process():
        """Wait briefly after last frame, then process."""
        await asyncio.sleep(0.3)
        await process_sign_frames()

    async def debounce_audio():
        """Wait briefly after last audio chunk, then transcribe."""
        await asyncio.sleep(0.5)
        await process_audio_chunks()

    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")

            if msg_type == "video_frame":
                frame_data = base64.b64decode(message["data"])
                async with frame_lock:
                    frame_buffer.append(frame_data)
                    # Keep at most 15 recent frames (~3s at 5 FPS)
                    if len(frame_buffer) > 15:
                        frame_buffer.pop(0)

                # Reset debounce timer
                if debounce_task and not debounce_task.done():
                    debounce_task.cancel()
                debounce_task = asyncio.create_task(debounce_process())

            elif msg_type == "audio_chunk":
                audio_data = base64.b64decode(message["data"])
                async with audio_lock:
                    audio_buffer.append(audio_data)

                # Reset audio debounce timer
                if audio_debounce_task and not audio_debounce_task.done():
                    audio_debounce_task.cancel()
                audio_debounce_task = asyncio.create_task(debounce_audio())

            elif msg_type == "end_turn":
                # Force process any buffered frames/audio immediately
                if debounce_task and not debounce_task.done():
                    debounce_task.cancel()
                if audio_debounce_task and not audio_debounce_task.done():
                    audio_debounce_task.cancel()
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
        if debounce_task and not debounce_task.done():
            debounce_task.cancel()
        if audio_debounce_task and not audio_debounce_task.done():
            audio_debounce_task.cancel()
        session_service.remove_session(session_id)
