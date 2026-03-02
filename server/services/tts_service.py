import logging

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from google.cloud import texttospeech
            self._client = texttospeech.TextToSpeechAsyncClient()
        return self._client

    async def synthesize(
        self, text: str, voice_id: str = "en-US-Neural2-F"
    ) -> bytes:
        """Convert text to speech audio bytes (MP3)."""
        from google.cloud import texttospeech

        voices = {
            "en-US-Neural2-F": ("en-US", texttospeech.SsmlVoiceGender.FEMALE),
            "en-US-Neural2-C": ("en-US", texttospeech.SsmlVoiceGender.FEMALE),
            "en-US-Neural2-D": ("en-US", texttospeech.SsmlVoiceGender.MALE),
            "en-US-Neural2-A": ("en-US", texttospeech.SsmlVoiceGender.MALE),
        }

        language_code, gender = voices.get(
            voice_id, ("en-US", texttospeech.SsmlVoiceGender.FEMALE)
        )

        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_id,
            ssml_gender=gender,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
        )

        try:
            response = await self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
            )
            return response.audio_content
        except Exception as e:
            logger.error(f"TTS synthesis failed: {e}")
            raise

    def get_available_voices(self) -> list:
        """Return list of available voices."""
        return [
            {"id": "en-US-Neural2-F", "name": "Emma", "gender": "female"},
            {"id": "en-US-Neural2-C", "name": "Ava", "gender": "female"},
            {"id": "en-US-Neural2-D", "name": "James", "gender": "male"},
            {"id": "en-US-Neural2-A", "name": "Michael", "gender": "male"},
        ]
