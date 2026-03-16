export interface ConversationMessage {
  id: string;
  timestamp: Date;
  type: 'signed' | 'spoken';
  text: string;
  speaker: 'user' | 'other';
  confidence?: number;
  participantId?: string;
  participantName?: string;
  gloss?: string;
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
  handsDownSegmentation: boolean;
  showAslGloss: boolean;
  continuousListening: boolean;
}

export type WSMessageType =
  | 'video_frame'
  | 'audio_chunk'
  | 'end_turn'
  | 'room_state'
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
  roomId?: string;
  participantId?: string;
  participantName?: string;
  participantCount?: number;
  participants?: RoomParticipant[];
  gloss?: string;
}

export interface RoomConnectionOptions {
  roomId?: string;
  participantId?: string;
  participantName?: string;
}

export interface RoomParticipant {
  participantId: string;
  participantName: string;
  activity: 'idle' | 'signing' | 'speaking' | 'processing' | string;
}

export interface CameraStatus {
  isActive: boolean;
  hasPermission: boolean;
  brightness: 'too_dark' | 'good' | 'too_bright';
  framing: 'good' | 'hands_not_visible' | 'too_close' | 'too_far';
}

export interface SignDetectionState {
  handsVisible: boolean;
  hasMotion: boolean;
  handCount: number;
  framing: CameraStatus['framing'];
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
