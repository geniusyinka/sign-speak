interface MuteButtonProps {
  isMuted: boolean;
  onToggle: () => void;
}

export function MuteButton({ isMuted, onToggle }: MuteButtonProps) {
  return (
    <button
      className={`mute-btn ${isMuted ? 'mute-btn--muted' : ''}`}
      onClick={onToggle}
      aria-label={isMuted ? 'Unmute speaker' : 'Mute speaker'}
      title={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728" />
        </svg>
      )}
    </button>
  );
}
