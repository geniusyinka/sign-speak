import type { ConversationMessage } from '../../types/index.ts';

interface MessageBubbleProps {
  message: ConversationMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.speaker === 'user';
  const typeLabel = message.type === 'signed' ? 'signed' : 'spoke';

  return (
    <div className={`message ${isUser ? 'message--user' : 'message--other'}`}>
      <div className="message__header">
        <span className="message__speaker">
          {isUser ? 'You' : 'Them'} ({typeLabel})
        </span>
        <span className="message__time">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="message__text">{message.text}</div>
      {message.confidence !== undefined && message.confidence < 0.7 && (
        <div className="message__low-confidence" aria-label="Low confidence translation">
          May not be accurate
        </div>
      )}
    </div>
  );
}
