import { useEffect, useRef } from 'react';

export interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  type: 'info' | 'model' | 'error' | 'frame';
}

interface DebugLogProps {
  entries: LogEntry[];
}

export function DebugLog({ entries }: DebugLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="debug-log">
        <div className="debug-log__header">Agent Log</div>
        <div className="debug-log__empty">Waiting for frames...</div>
      </div>
    );
  }

  return (
    <div className="debug-log">
      <div className="debug-log__header">Agent Log</div>
      <div className="debug-log__entries">
        {entries.map((entry) => (
          <div key={entry.id} className={`debug-log__entry debug-log__entry--${entry.type}`}>
            <span className="debug-log__time">
              {entry.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="debug-log__msg">{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
