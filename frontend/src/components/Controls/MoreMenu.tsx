import { useState, useRef, useEffect, useCallback } from 'react';

interface MoreMenuProps {
  children: React.ReactNode;
}

export function MoreMenu({ children }: MoreMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  return (
    <div className="more-menu" ref={menuRef}>
      <button
        className="more-menu__trigger"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="More options"
        aria-expanded={isOpen}
        title="More options"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {isOpen && (
        <div className="more-menu__popover" onClick={close}>
          {children}
        </div>
      )}
    </div>
  );
}
