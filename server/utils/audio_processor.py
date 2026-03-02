import base64


def decode_audio(base64_data: str) -> bytes:
    """Decode base64-encoded audio data."""
    return base64.b64decode(base64_data)


def encode_audio(audio_data: bytes) -> str:
    """Encode audio bytes to base64."""
    return base64.b64encode(audio_data).decode("utf-8")
