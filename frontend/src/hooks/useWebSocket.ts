import { useRef, useState, useCallback, useEffect } from 'react';
import { WebSocketService } from '../services/WebSocketService.ts';
import type { RoomConnectionOptions, WSMessage } from '../types/index.ts';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useWebSocket(url?: string) {
  const wsService = useRef<WebSocketService | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const messageHandlersRef = useRef<((msg: WSMessage) => void)[]>([]);

  const connect = useCallback((options?: RoomConnectionOptions) => {
    if (wsService.current) {
      wsService.current.disconnect();
    }

    wsService.current = new WebSocketService(url, options);

    wsService.current.onStatus((status) => {
      setConnectionStatus(status);
    });

    wsService.current.onMessage((message) => {
      messageHandlersRef.current.forEach((handler) => handler(message));
    });

    wsService.current.connect();
  }, [url]);

  const disconnect = useCallback(() => {
    wsService.current?.disconnect();
    wsService.current = null;
  }, []);

  const sendVideoFrame = useCallback((frameData: string) => {
    wsService.current?.sendVideoFrame(frameData);
  }, []);

  const sendAudioChunk = useCallback((audioData: string) => {
    wsService.current?.sendAudioChunk(audioData);
  }, []);

  const sendEndTurn = useCallback(() => {
    wsService.current?.sendEndTurn();
  }, []);

  const onMessage = useCallback((handler: (msg: WSMessage) => void) => {
    messageHandlersRef.current.push(handler);
    return () => {
      messageHandlersRef.current = messageHandlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  useEffect(() => {
    return () => {
      wsService.current?.disconnect();
    };
  }, []);

  return {
    connectionStatus,
    connect,
    disconnect,
    sendVideoFrame,
    sendAudioChunk,
    sendEndTurn,
    onMessage,
  };
}
