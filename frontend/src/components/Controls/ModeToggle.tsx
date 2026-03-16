interface ModeToggleProps {
  currentMode: 'signing' | 'listening' | 'idle';
  onModeChange: (mode: 'signing' | 'listening' | 'idle') => void;
}

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Communication mode">
      <button
        className={`mode-toggle__btn ${currentMode === 'signing' ? 'mode-toggle__btn--active' : ''}`}
        onClick={() => onModeChange('signing')}
        role="radio"
        aria-checked={currentMode === 'signing'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
        </svg>
        Sign
      </button>
      <button
        className={`mode-toggle__btn ${currentMode === 'listening' ? 'mode-toggle__btn--active' : ''}`}
        onClick={() => onModeChange('listening')}
        role="radio"
        aria-checked={currentMode === 'listening'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
        </svg>
        Speak
      </button>
    </div>
  );
}
