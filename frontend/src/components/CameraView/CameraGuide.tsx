export function CameraGuide() {
  return (
    <div className="camera-guide">
      <div className="camera-guide__content">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p>Click "Start" to enable your camera</p>
        <p className="camera-guide__hint">Position yourself so your hands and face are visible</p>
      </div>
    </div>
  );
}
