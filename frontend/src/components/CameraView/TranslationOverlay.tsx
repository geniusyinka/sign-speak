import { useState, useEffect, useRef } from 'react';

interface TranslationOverlayProps {
  text: string | null;
  partial: string | null;
}

export function TranslationOverlay({ text, partial }: TranslationOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [displayText, setDisplayText] = useState<string | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text) {
      setDisplayText(text);
      setVisible(true);

      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }

      fadeTimerRef.current = setTimeout(() => {
        setVisible(false);
        fadeTimerRef.current = null;
      }, 5000);
    } else {
      setVisible(false);
    }

    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, [text]);

  const showFinal = visible && displayText;
  const showPartial = partial && !showFinal;

  if (!showFinal && !showPartial) return null;

  return (
    <div
      className={`translation-overlay ${showFinal ? 'translation-overlay--visible' : 'translation-overlay--hidden'}`}
      aria-live="polite"
    >
      {showFinal && <span>{displayText}</span>}
      {showPartial && (
        <span className="translation-overlay__partial">{partial}</span>
      )}
    </div>
  );
}
