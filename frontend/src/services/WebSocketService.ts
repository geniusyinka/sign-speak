import type { WSMessage } from '../types/index.ts';

type MessageHandler = (message: WSMessage) => void;
type StatusHandler = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private url: string;
  private shouldReconnect = true;

  constructor(url?: string) {
    const configuredBase = import.meta.env.VITE_WEBSOCKET_BASE_URL?.trim();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultBase = `${protocol}//${window.location.host}`;
    const base = configuredBase || defaultBase;
    this.url = url || `${base.replace(/\/$/, '')}/ws/conversation`;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.notifyStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.messageHandlers.forEach((handler) => handler(message));
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        this.notifyStatus('disconnected');
        this.ws = null;
        if (this.shouldReconnect) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        this.notifyStatus('error');
      };
    } catch {
      this.notifyStatus('error');
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendVideoFrame(frameData: string): void {
    this.send({ type: 'video_frame', data: frameData });
  }

  sendAudioChunk(audioData: string): void {
    this.send({ type: 'audio_chunk', data: audioData });
  }

  sendEndTurn(): void {
    this.send({ type: 'end_turn' });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private notifyStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
