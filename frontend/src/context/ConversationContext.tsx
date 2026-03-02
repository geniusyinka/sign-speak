import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ConversationMessage } from '../types/index.ts';

interface ConversationContextValue {
  messages: ConversationMessage[];
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  currentMode: 'signing' | 'listening' | 'idle';
  setCurrentMode: (mode: 'signing' | 'listening' | 'idle') => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

let messageId = 0;

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentMode, setCurrentMode] = useState<'signing' | 'listening' | 'idle'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);

  const addMessage = useCallback(
    (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
      const fullMessage: ConversationMessage = {
        ...message,
        id: String(++messageId),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.slice(-19), fullMessage]);
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        messages,
        addMessage,
        clearMessages,
        currentMode,
        setCurrentMode,
        isProcessing,
        setIsProcessing,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation(): ConversationContextValue {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversation must be used within ConversationProvider');
  return ctx;
}
