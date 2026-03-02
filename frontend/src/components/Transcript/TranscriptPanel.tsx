import { useRef, useEffect } from 'react';
import { useConversation } from '../../context/ConversationContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import { TypingIndicator } from './TypingIndicator.tsx';

export function TranscriptPanel() {
  const { messages, isProcessing, currentMode } = useConversation();
  const { settings } = useSettings();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const textSizeClass = `transcript--${settings.textSize}`;

  if (!settings.showHistory && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    return (
      <div className={`transcript transcript--large-display ${textSizeClass}`}>
        <div className="transcript__large-text">
          <p>{lastMessage.text}</p>
        </div>
        {isProcessing && <TypingIndicator mode={currentMode} />}
      </div>
    );
  }

  return (
    <div className={`transcript ${textSizeClass}`} role="log" aria-label="Conversation transcript">
      <div className="transcript__messages">
        {messages.length === 0 && (
          <div className="transcript__empty">
            <p>Your conversation will appear here</p>
            <p className="transcript__empty-hint">
              Sign to the camera or speak to start
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isProcessing && <TypingIndicator mode={currentMode} />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
