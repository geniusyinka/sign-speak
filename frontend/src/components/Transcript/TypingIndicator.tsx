interface TypingIndicatorProps {
  mode: 'signing' | 'listening' | 'idle';
}

export function TypingIndicator({ mode }: TypingIndicatorProps) {
  if (mode === 'idle') return null;

  const text = mode === 'signing' ? 'Interpreting signs...' : 'Listening...';

  return (
    <div className="typing-indicator" aria-live="polite">
      <div className="typing-indicator__dots">
        <span />
        <span />
        <span />
      </div>
      <span className="typing-indicator__text">{text}</span>
    </div>
  );
}
