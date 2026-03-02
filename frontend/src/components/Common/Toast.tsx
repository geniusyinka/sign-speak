import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'info' | 'error' | 'success';
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ message, type = 'info', duration = 4000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      className={`toast toast--${type} ${visible ? 'toast--visible' : 'toast--hidden'}`}
      role="alert"
    >
      <p>{message}</p>
      <button className="toast__close" onClick={onDismiss} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}
