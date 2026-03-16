from __future__ import annotations

import os
import logging
import struct
from typing import Optional, AsyncIterator
from google import genai
from google.genai import types
from prompts.sign_recognition import (
    SYSTEM_INSTRUCTION,
    SINGLE_FRAME_PROMPT,
    MULTI_FRAME_PROMPT,
    CONTEXTUAL_SUFFIX,
)

logger = logging.getLogger(__name__)

MAX_VISION_FRAMES = 18

# Vision model for sign recognition
VISION_MODEL = "gemini-2.5-flash"

# Live model for real-time audio streaming (speech-to-text)
LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"


class GeminiService:
    """Hybrid Gemini service:
    - Vision API (standard) for sign language recognition from video frames
    - Live API (streaming) for real-time speech transcription
    """

    def __init__(self):
        self._client: Optional[genai.Client] = None
        self._live_client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        """Standard API client for vision/sign recognition."""
        if self._client is None:
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable is not set")
            self._client = genai.Client(api_key=api_key)
        return self._client

    @property
    def live_client(self) -> genai.Client:
        """Live API client for real-time audio streaming."""
        if self._live_client is None:
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable is not set")
            self._live_client = genai.Client(
                api_key=api_key,
                http_options={"api_version": "v1alpha"},
            )
        return self._live_client

    def _build_config(self, allow_thinking: bool = True) -> types.GenerateContentConfig:
        """Build generation config. Allow thinking for better accuracy."""
        config_kwargs = {
            "system_instruction": SYSTEM_INSTRUCTION,
            "temperature": 0.2,
        }
        if not allow_thinking:
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        return types.GenerateContentConfig(**config_kwargs)

    def _build_prompt(
        self,
        base_prompt: str,
        conversation_history: list[dict] | None = None,
    ) -> str:
        prompt = base_prompt
        if conversation_history:
            history_text = "\n".join(
                [f"- {m['speaker']}: {m['text']}" for m in conversation_history[-20:]]
            )
            prompt += CONTEXTUAL_SUFFIX.format(history=history_text)
        return prompt

    # ── Sign Recognition (Vision API) ──────────────────────────────

    async def recognize_sign(
        self, frame_data: bytes, conversation_history: list[dict] | None = None
    ) -> AsyncIterator[str]:
        """Send a video frame and get sign language translation via streaming."""
        prompt = self._build_prompt(SINGLE_FRAME_PROMPT, conversation_history)

        content = types.Content(
            parts=[
                types.Part(
                    inline_data=types.Blob(
                        mime_type="image/jpeg",
                        data=frame_data,
                    )
                ),
                types.Part(text=prompt),
            ],
            role="user",
        )

        stream = await self.client.aio.models.generate_content_stream(
            model=VISION_MODEL,
            contents=[content],
            config=self._build_config(allow_thinking=True),
        )

        async for chunk in stream:
            if chunk.text:
                yield chunk.text

    async def recognize_sign_batch(
        self, frames: list[bytes], conversation_history: list[dict] | None = None
    ) -> str:
        """Send multiple frames for better sign recognition accuracy."""
        prompt = self._build_prompt(MULTI_FRAME_PROMPT, conversation_history)

        parts = []
        for frame in _sample_frames(frames, MAX_VISION_FRAMES):
            parts.append(
                types.Part(
                    inline_data=types.Blob(
                        mime_type="image/jpeg",
                        data=frame,
                    )
                )
            )
        parts.append(types.Part(text=prompt))

        content = types.Content(parts=parts, role="user")

        response = await self.client.aio.models.generate_content(
            model=VISION_MODEL,
            contents=[content],
            config=self._build_config(allow_thinking=True),
        )
        return response.text or ""

    # ── Speech-to-Text (Standard API) ───────────────────────────────

    async def transcribe_audio(
        self, audio_data: bytes, conversation_history: list[dict] | None = None
    ) -> str:
        """Transcribe speech audio to text using the standard Gemini API."""
        prompt = (
            "Transcribe the following audio exactly as spoken. "
            "Return ONLY the transcribed text, nothing else. "
            "If the audio is unclear or silent, respond with [silent]."
        )
        if conversation_history:
            history_text = "\n".join(
                [f"- {m['speaker']}: {m['text']}" for m in conversation_history[-12:]]
            )
            prompt += f"\n\nCONVERSATION SO FAR:\n{history_text}"

        wav_data = _pcm_to_wav(audio_data, sample_rate=16000, channels=1, sample_width=2)

        content = types.Content(
            parts=[
                types.Part(
                    inline_data=types.Blob(
                        mime_type="audio/wav",
                        data=wav_data,
                    )
                ),
                types.Part(text=prompt),
            ],
            role="user",
        )

        response = await self.client.aio.models.generate_content(
            model=VISION_MODEL,
            contents=[content],
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                temperature=0.1,
            ),
        )
        return response.text or ""

    # ── Live API (real-time audio streaming) ──────────────────────

    async def create_live_session(self):
        """Create a Live API session for real-time audio conversation."""
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction="You are a real-time speech transcriber. Listen to audio and respond naturally.",
        )
        session = self.live_client.aio.live.connect(
            model=LIVE_MODEL,
            config=config,
        )
        logger.info("Created Gemini Live session")
        return session

    async def send_audio_to_live(self, session, audio_data: bytes) -> None:
        """Send audio chunk to Live API session."""
        await session.send_realtime_input(
            audio=types.Blob(
                mime_type="audio/pcm",
                data=audio_data,
            )
        )

    async def receive_live_responses(self, session) -> AsyncIterator[dict]:
        """Receive responses from Live API session."""
        async for response in session.receive():
            if response.text:
                yield {"type": "transcription", "text": response.text}
            if response.server_content:
                if response.server_content.model_turn:
                    for part in response.server_content.model_turn.parts:
                        if part.inline_data and part.inline_data.data:
                            yield {
                                "type": "audio",
                                "data": part.inline_data.data,
                                "mime_type": part.inline_data.mime_type or "audio/pcm",
                            }
                if response.server_content.turn_complete:
                    yield {"type": "turn_complete"}


def _sample_frames(frames: list[bytes], limit: int) -> list[bytes]:
    if len(frames) <= limit:
        return frames

    if limit <= 1:
        return [frames[-1]]

    step = (len(frames) - 1) / (limit - 1)
    return [frames[round(i * step)] for i in range(limit)]


def _pcm_to_wav(
    pcm_data: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
    sample_width: int = 2,
) -> bytes:
    """Wrap raw PCM bytes in a WAV header."""
    data_size = len(pcm_data)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        channels,
        sample_rate,
        sample_rate * channels * sample_width,
        channels * sample_width,
        sample_width * 8,
        b"data",
        data_size,
    )
    return header + pcm_data
