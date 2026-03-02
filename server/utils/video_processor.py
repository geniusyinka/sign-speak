import base64


def decode_frame(base64_data: str) -> bytes:
    """Decode a base64-encoded JPEG frame."""
    return base64.b64decode(base64_data)


def encode_frame(frame_data: bytes) -> str:
    """Encode frame bytes to base64."""
    return base64.b64encode(frame_data).decode("utf-8")
