import type { ConversationMessage } from '../../types/index.ts';
import { useSettings } from '../../context/SettingsContext.tsx';

interface MessageBubbleProps {
  message: ConversationMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { settings } = useSettings();
  const isUser = message.speaker === 'user';
  const typeLabel = message.type === 'signed' ? 'signed' : 'spoke';
  const speakerLabel = message.participantName
    ? isUser
      ? `You • ${message.participantName}`
      : message.participantName
    : isUser
      ? 'You'
      : 'Them';

  return (
    <div className={`message ${isUser ? 'message--user' : 'message--other'}`}>
      <div className="message__header">
        <span className="message__speaker">
          {speakerLabel} ({typeLabel})
        </span>
        <span className="message__time">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="message__text">{message.text}</div>
      {settings.showAslGloss && message.type === 'spoken' && message.gloss && (
        <div className="message__gloss" aria-label="ASL gloss">
          <span className="message__gloss-label">ASL gloss</span>
          <span className="message__gloss-text">{message.gloss}</span>
        </div>
      )}
      {message.confidence !== undefined && message.confidence < 0.7 && (
        <div className="message__low-confidence" aria-label="Low confidence translation">
          May not be accurate
        </div>
      )}
    </div>
  );
}
