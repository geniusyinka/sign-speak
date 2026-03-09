export interface ConversationMessage {
  id: string;
  timestamp: Date;
  type: 'signed' | 'spoken';
  text: string;
  speaker: 'user' | 'other';
  confidence?: number;
}

export interface ConversationSession {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  messages: ConversationMessage[];
  settings: UserSettings;
}

export interface UserSettings {
  voiceId: string;
  voiceName: string;
  textSize: 'small' | 'medium' | 'large' | 'xlarge';
  highContrast: boolean;
  showHistory: boolean;
  autoHideCamera: boolean;
}

export type WSMessageType =
  | 'video_frame'
  | 'audio_chunk'
  | 'end_turn'
  | 'translation'
  | 'partial'
  | 'audio'
  | 'error'
  | 'status'
  | 'debug';

export interface WSMessage {
  type: WSMessageType;
  data?: string;
  text?: string;
  error?: string;
  message?: string;
  confidence?: number;
  source?: 'signed' | 'spoken';
  status?: 'ready' | 'processing' | 'error';
}

export interface CameraStatus {
  isActive: boolean;
  hasPermission: boolean;
  brightness: 'too_dark' | 'good' | 'too_bright';
  framing: 'good' | 'hands_not_visible' | 'too_close' | 'too_far';
}

export interface AppState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  cameraStatus: CameraStatus;
  currentMode: 'signing' | 'listening' | 'idle';
  conversation: ConversationMessage[];
  settings: UserSettings;
  isProcessing: boolean;
  error: string | null;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  previewUrl?: string;
}
