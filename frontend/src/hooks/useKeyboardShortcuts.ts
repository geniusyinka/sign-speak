import { useEffect, useRef } from 'react';

interface KeyboardShortcutOptions {
  onEscape?: () => void;
}

export function useKeyboardShortcuts({ onEscape }: KeyboardShortcutOptions) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscapeRef.current) {
        onEscapeRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
