import { useState, useCallback, useEffect, useRef } from 'react';
import { CameraView } from './components/CameraView/CameraView.tsx';
import { DebugLog, type LogEntry } from './components/CameraView/DebugLog.tsx';
import { TranscriptPanel } from './components/Transcript/TranscriptPanel.tsx';
import { ModeToggle } from './components/Controls/ModeToggle.tsx';
import { MuteButton } from './components/Controls/MuteButton.tsx';
import { SettingsPanel } from './components/Controls/SettingsPanel.tsx';
import { Button } from './components/Common/Button.tsx';
import { Toast } from './components/Common/Toast.tsx';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { useMicrophone } from './hooks/useMicrophone.ts';
import { useSpeech } from './hooks/useSpeech.ts';
import { useConversation } from './context/ConversationContext.tsx';
import { useSettings } from './context/SettingsContext.tsx';
import { playSuccessChime } from './utils/chime.ts';
import type { RoomParticipant } from './types/index.ts';

interface ActiveRoomSession {
  roomId: string;
  participantId: string;
  participantName: string;
  participantCount: number;
}

function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function App() {
  const MIN_SIGN_FRAMES = 8;
  const MAX_SIGN_FRAMES = 48;
  const HANDS_DOWN_GRACE_MS = 900;
  const [isStarted, setIsStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [partialText, setPartialText] = useState<string | null>(null);
  const [lastTranslation, setLastTranslation] = useState<string | null>(null);
  const [bufferedSignFrames, setBufferedSignFrames] = useState(0);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [translationSuccess, setTranslationSuccess] = useState(false);
  const [handsVisible, setHandsVisible] = useState(false);
  const [lastAudioActivityAt, setLastAudioActivityAt] = useState<number | null>(null);
  const [manualListeningActive, setManualListeningActive] = useState(false);
  const [debugEntries, setDebugEntries] = useState<LogEntry[]>([]);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [participantNameInput, setParticipantNameInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<ActiveRoomSession | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>([]);
  const [inviteCopied, setInviteCopied] = useState(false);
  const logIdRef = useRef(0);
  const handsDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signSessionActiveRef = useRef(false);
  const activeRoomRef = useRef<ActiveRoomSession | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setDebugEntries((prev) => {
      const entry: LogEntry = { id: ++logIdRef.current, timestamp: new Date(), message, type };
      const next = [...prev, entry];
      return next.length > 80 ? next.slice(-60) : next;
    });
  }, []);

  const { settings } = useSettings();
  const {
    messages,
    addMessage,
    clearMessages,
    currentMode,
    setCurrentMode,
    isProcessing,
    setIsProcessing,
  } = useConversation();
  const { connectionStatus, connect, disconnect, sendVideoFrame, sendAudioChunk, sendEndTurn, onMessage } =
    useWebSocket();
  const { isSpeaking, isMuted, speak, speakText, toggleMute } = useSpeech();

  const handleAudioChunk = useCallback(
    (data: string) => {
      setLastAudioActivityAt(Date.now());
      sendAudioChunk(data);
    },
    [sendAudioChunk]
  );

  const {
    isCapturing: isMicCapturing,
    hasPermission: hasMicPermission,
    startCapture: startMic,
    stopCapture: stopMic,
  } = useMicrophone(handleAudioChunk);
  const canInterpretSign =
    connectionStatus === 'connected' && !isProcessing && bufferedSignFrames >= MIN_SIGN_FRAMES;
  const roomInviteUrl = activeRoom
    ? `${window.location.origin}${window.location.pathname}?room=${activeRoom.roomId}`
    : '';

  // Track pending translation text for browser TTS fallback
  const pendingTTSRef = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const isAudioRecentlyActive = lastAudioActivityAt !== null && Date.now() - lastAudioActivityAt < 1400;
  const listenStatus =
    currentMode !== 'listening'
      ? null
      : !settings.continuousListening && !manualListeningActive && !isMicCapturing
        ? {
            label: 'Tap Start Listening when you want to record speech.',
            tone: 'muted' as const,
          }
        : isProcessing
        ? {
            label: 'Transcribing speech...',
            tone: 'processing' as const,
          }
        : isAudioRecentlyActive
          ? {
              label: 'Speech detected. Keep talking...',
              tone: 'active' as const,
            }
          : isMicCapturing
            ? {
                label: 'Microphone live. Start speaking.',
                tone: 'ready' as const,
              }
            : hasMicPermission === false
              ? {
                  label: 'Microphone permission is required for Listen Mode.',
                  tone: 'error' as const,
                }
              : {
                  label: 'Starting microphone...',
                  tone: 'muted' as const,
                };

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    const prefilledRoom = normalizeRoomCode(new URLSearchParams(window.location.search).get('room') ?? '');
    if (prefilledRoom) {
      setRoomCodeInput(prefilledRoom);
    }
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    const unsub = onMessage((msg) => {
      switch (msg.type) {
        case 'partial':
          // Live streaming partial result — show immediately
          if (msg.text) {
            setPartialText(msg.text);
          }
          break;
        case 'translation':
          if (msg.text) {
            setPartialText(null);
            setIsProcessing(false);
            setBufferedSignFrames(0);
            signSessionActiveRef.current = false;
            const source = msg.source ?? 'spoken';
            const localRoom = activeRoomRef.current;
            const isOwnParticipant = localRoom && msg.participantId
              ? msg.participantId === localRoom.participantId
              : source === 'signed';
            addMessage({
              type: source,
              text: msg.text,
              speaker: isOwnParticipant ? 'user' : 'other',
              confidence: msg.confidence,
              participantId: msg.participantId,
              participantName: msg.participantName,
              gloss: msg.gloss,
            });

            // In signing mode, speak the translation aloud for the hearing person.
            // Set a fallback timer: if no server audio arrives within 300ms, use browser TTS.
            // In listening mode, text is displayed for the deaf user — no TTS needed.
            if (source === 'signed' && isOwnParticipant) {
              setLastTranslation(msg.text);
              setTranslationSuccess(true);
              setTimeout(() => setTranslationSuccess(false), 800);
              if (!isMuted) {
                playSuccessChime();
              }
              if (pendingTTSRef.current) {
                clearTimeout(pendingTTSRef.current.timer);
              }
              const timer = setTimeout(() => {
                speakText(msg.text!);
                pendingTTSRef.current = null;
              }, 300);
              pendingTTSRef.current = { text: msg.text, timer };
            }
            if (source === 'spoken') {
              setLastAudioActivityAt(null);
            }
          }
          break;
        case 'audio':
          if (msg.data) {
            // Server audio arrived — cancel browser TTS fallback
            if (pendingTTSRef.current) {
              clearTimeout(pendingTTSRef.current.timer);
              pendingTTSRef.current = null;
            }
            speak(msg.data);
          }
          break;
        case 'status':
          if (msg.status === 'processing') {
            setIsProcessing(true);
          } else if (msg.status === 'ready') {
            setIsProcessing(false);
            setBufferedSignFrames(0);
            signSessionActiveRef.current = false;
            if (currentMode === 'listening') {
              setLastAudioActivityAt(null);
            }
          }
          break;
        case 'room_state':
          if (msg.roomId) {
            setRoomParticipants(msg.participants ?? []);
            setActiveRoom((prev) => {
              if (!prev) {
                return {
                  roomId: msg.roomId!,
                  participantId: msg.participantId ?? '',
                  participantName: msg.participantName ?? 'Guest',
                  participantCount: msg.participantCount ?? 1,
                };
              }
              return {
                ...prev,
                roomId: msg.roomId ?? prev.roomId,
                participantId: msg.participantId ?? prev.participantId,
                participantName: msg.participantName ?? prev.participantName,
                participantCount: msg.participantCount ?? prev.participantCount,
              };
            });
          }
          break;
        case 'debug':
          if (msg.message) {
            const isModel = msg.message.startsWith('Gemini response:');
            addLog(msg.message, isModel ? 'model' : 'info');
          }
          break;
        case 'error':
          addLog(msg.error || 'Error', 'error');
          setToast({ message: msg.error || 'An error occurred', type: 'error' });
          setIsProcessing(false);
          break;
      }
    });
    return unsub;
  }, [onMessage, addMessage, speak, speakText, setIsProcessing, isMuted]);

  const updateRoomUrl = useCallback((roomId: string | null) => {
    const nextUrl = roomId
      ? `${window.location.pathname}?room=${roomId}`
      : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  const beginSession = useCallback((roomSession: ActiveRoomSession | null) => {
    clearMessages();
    setPartialText(null);
    setLastTranslation(null);
    setBufferedSignFrames(0);
    setDebugEntries([]);
    logIdRef.current = 0;
    setInviteCopied(false);
    setRoomParticipants([]);
    connect(
      roomSession
        ? {
            roomId: roomSession.roomId,
            participantId: roomSession.participantId,
            participantName: roomSession.participantName,
          }
        : undefined
    );
    setActiveRoom(roomSession);
    updateRoomUrl(roomSession?.roomId ?? null);
    setIsStarted(true);
    setCurrentMode('signing');
  }, [clearMessages, connect, setCurrentMode, updateRoomUrl]);

  const handleStart = useCallback(() => {
    beginSession(null);
  }, [beginSession]);

  const handleCreateRoom = useCallback(() => {
    const roomId = generateRoomCode();
    const participantName = participantNameInput.trim() || 'Host';
    setRoomCodeInput(roomId);
    beginSession({
      roomId,
      participantId: crypto.randomUUID(),
      participantName,
      participantCount: 1,
    });
  }, [beginSession, participantNameInput]);

  const handleJoinRoom = useCallback(() => {
    const roomId = normalizeRoomCode(roomCodeInput);
    if (!roomId) {
      setToast({ message: 'Enter a room code to join', type: 'error' });
      return;
    }
    beginSession({
      roomId,
      participantId: crypto.randomUUID(),
      participantName: participantNameInput.trim() || 'Guest',
      participantCount: 1,
    });
  }, [beginSession, participantNameInput, roomCodeInput]);

  const handleCopyInvite = useCallback(async () => {
    if (!roomInviteUrl) return;
    await navigator.clipboard.writeText(roomInviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 1500);
  }, [roomInviteUrl]);

  const handleStop = useCallback(() => {
    if (handsDownTimerRef.current) {
      clearTimeout(handsDownTimerRef.current);
      handsDownTimerRef.current = null;
    }
    disconnect();
    stopMic();
    setIsStarted(false);
    if (activeRoomRef.current) {
      setRoomCodeInput(activeRoomRef.current.roomId);
    }
    setBufferedSignFrames(0);
    setHandsVisible(false);
    setLastAudioActivityAt(null);
    setManualListeningActive(false);
    signSessionActiveRef.current = false;
    setActiveRoom(null);
    setRoomParticipants([]);
    clearMessages();
    updateRoomUrl(null);
    setCurrentMode('idle');
  }, [clearMessages, disconnect, stopMic, setCurrentMode, updateRoomUrl]);

  const handleToggleListeningCapture = useCallback(async () => {
    if (isMicCapturing) {
      setManualListeningActive(false);
      stopMic();
      setLastAudioActivityAt(null);
      sendEndTurn();
      return;
    }
    setManualListeningActive(true);
    await startMic();
  }, [isMicCapturing, sendEndTurn, startMic, stopMic]);

  const handleModeChange = useCallback(
    (mode: 'signing' | 'listening' | 'idle') => {
      if (mode === currentMode) return;
      sendEndTurn();
      setCurrentMode(mode);
      setBufferedSignFrames(0);
      setHandsVisible(false);
      signSessionActiveRef.current = false;
      if (handsDownTimerRef.current) {
        clearTimeout(handsDownTimerRef.current);
        handsDownTimerRef.current = null;
      }

      if (mode === 'listening') {
        setLastAudioActivityAt(null);
        if (settings.continuousListening) {
          setManualListeningActive(false);
          startMic();
        } else {
          setManualListeningActive(false);
          stopMic();
        }
      } else {
        setLastAudioActivityAt(null);
        setManualListeningActive(false);
        stopMic();
      }
    },
    [currentMode, sendEndTurn, setCurrentMode, settings.continuousListening, startMic, stopMic]
  );

  const handleInterpretSign = useCallback(() => {
    if (bufferedSignFrames < MIN_SIGN_FRAMES) return;
    addLog(`Submitting sign clip with ${bufferedSignFrames} buffered frame(s)`);
    signSessionActiveRef.current = false;
    if (handsDownTimerRef.current) {
      clearTimeout(handsDownTimerRef.current);
      handsDownTimerRef.current = null;
    }
    setIsProcessing(true);
    sendEndTurn();
  }, [bufferedSignFrames, sendEndTurn, setIsProcessing, addLog]);

  const frameCountRef = useRef(0);
  const bufferedSignFramesRef = useRef(0);

  // Keep ref in sync with state so the auto-submit timer closure reads the latest count
  useEffect(() => {
    bufferedSignFramesRef.current = bufferedSignFrames;
  }, [bufferedSignFrames]);

  const finalizeSigningSegment = useCallback(() => {
    handsDownTimerRef.current = null;
    signSessionActiveRef.current = false;

    if (bufferedSignFramesRef.current >= MIN_SIGN_FRAMES) {
      addLog(
        `Hands lowered; interpreting signed phrase (${bufferedSignFramesRef.current} frames collected)`
      );
      setIsProcessing(true);
      sendEndTurn();
      return;
    }

    if (bufferedSignFramesRef.current > 0) {
      addLog(
        `Hands lowered before enough context was captured (${bufferedSignFramesRef.current}/${MIN_SIGN_FRAMES} frames)`,
        'info'
      );
    }
    setBufferedSignFrames(0);
  }, [MIN_SIGN_FRAMES, addLog, sendEndTurn, setIsProcessing]);

  const handleDetectionStateChange = useCallback(
    ({ handsVisible: nextHandsVisible }: { handsVisible: boolean }) => {
      setHandsVisible(nextHandsVisible);

      if (currentMode !== 'signing' || isProcessing || !settings.handsDownSegmentation) {
        return;
      }

      if (nextHandsVisible) {
        if (handsDownTimerRef.current) {
          clearTimeout(handsDownTimerRef.current);
          handsDownTimerRef.current = null;
          addLog('Hands re-entered frame; continuing current signed phrase');
        } else if (!signSessionActiveRef.current) {
          addLog('Hands detected; started a signing phrase');
        }
        signSessionActiveRef.current = true;
        return;
      }

      if (!signSessionActiveRef.current || handsDownTimerRef.current) {
        return;
      }

      addLog(`Hands left frame; finalizing phrase in ${HANDS_DOWN_GRACE_MS}ms unless signing resumes`);
      handsDownTimerRef.current = setTimeout(finalizeSigningSegment, HANDS_DOWN_GRACE_MS);
    },
    [HANDS_DOWN_GRACE_MS, addLog, currentMode, finalizeSigningSegment, isProcessing, settings.handsDownSegmentation]
  );

  const handleFrame = useCallback(
    (frameData: string) => {
      if (currentMode === 'signing' && !isProcessing) {
        frameCountRef.current++;
        setBufferedSignFrames((count) => Math.min(count + 1, MAX_SIGN_FRAMES));

        if (frameCountRef.current % 5 === 1) {
          addLog(`Frame sent (${Math.round(frameData.length * 0.75 / 1024)}KB)`, 'frame');
        }
        sendVideoFrame(frameData);
      }
    },
    [MAX_SIGN_FRAMES, currentMode, isProcessing, sendVideoFrame, addLog]
  );

  useEffect(() => {
    return () => {
      if (handsDownTimerRef.current) {
        clearTimeout(handsDownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentMode !== 'signing') return;
    if (bufferedSignFrames === 0) {
      addLog('Sign buffer cleared');
    } else if (bufferedSignFrames === MIN_SIGN_FRAMES) {
      addLog(`Sign buffer ready (${MIN_SIGN_FRAMES} frames)`);
    }
  }, [bufferedSignFrames, currentMode, addLog, MIN_SIGN_FRAMES]);

  useEffect(() => {
    if (currentMode !== 'listening') return;
    if (settings.continuousListening) {
      if (manualListeningActive) {
        setManualListeningActive(false);
      }
      if (!isMicCapturing) {
        startMic();
      }
      return;
    }
    if (!manualListeningActive && isMicCapturing) {
      stopMic();
      setLastAudioActivityAt(null);
    }
  }, [currentMode, isMicCapturing, manualListeningActive, settings.continuousListening, startMic, stopMic]);

  // Landing page
  if (!isStarted) {
    return (
      <div className={`app ${settings.highContrast ? 'app--high-contrast' : ''}`}>
        <div className="landing">
          <div className="landing__content">
            <div className="landing__icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 11.5V14a2 2 0 0 0 2 2h1" />
                <path d="M11 6.5V3a1 1 0 0 1 2 0v3.5" />
                <path d="M14 5.5V3a1 1 0 0 1 2 0v4" />
                <path d="M8 8.5V3.5a1 1 0 0 1 2 0V9" />
                <path d="M16 9V6a1 1 0 0 1 2 0v7a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.27-3.15" />
              </svg>
            </div>
            <h1 className="landing__title">SignSpeak Live</h1>
            <p className="landing__tagline">Your voice, their signs. Their signs, your voice.</p>
            <p className="landing__description">
              Real-time sign language interpreter powered by AI. Enable natural conversation
              between deaf/hard-of-hearing and hearing individuals.
            </p>
            <Button size="lg" onClick={handleStart}>
              Get Started
            </Button>
            <div className="landing__room-card">
              <div className="landing__room-header">
                <h2>Shared Room</h2>
                <p>Create a room or join one without changing the solo experience.</p>
              </div>
              <div className="landing__room-fields">
                <label className="landing__field">
                  <span>Your name</span>
                  <input
                    value={participantNameInput}
                    onChange={(e) => setParticipantNameInput(e.target.value)}
                    placeholder="Ava"
                    maxLength={40}
                  />
                </label>
                <label className="landing__field">
                  <span>Room code</span>
                  <input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(normalizeRoomCode(e.target.value))}
                    placeholder="AB12CD"
                    maxLength={8}
                  />
                </label>
              </div>
              <div className="landing__room-actions">
                <Button variant="secondary" onClick={handleCreateRoom}>
                  Create Room
                </Button>
                <Button onClick={handleJoinRoom}>
                  Join Room
                </Button>
              </div>
            </div>
            <div className="landing__permissions">
              <p>SignSpeak needs access to:</p>
              <ul>
                <li>Camera - to see your signs</li>
                <li>Microphone - to hear speech</li>
                <li>Speakers - to speak translations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showCamera = currentMode === 'signing' || !settings.autoHideCamera;
  const remoteParticipants = activeRoom
    ? roomParticipants.filter((participant) => participant.participantId !== activeRoom.participantId)
    : [];

  return (
    <div className={`app ${settings.highContrast ? 'app--high-contrast' : ''}`}>
      <header className="app-header">
        <h1 className="app-header__title">SignSpeak</h1>
        <div className="app-header__meta">
          {activeRoom && (
            <div className="app-header__room">
              <span>Room {activeRoom.roomId}</span>
              <span>{activeRoom.participantCount} {activeRoom.participantCount === 1 ? 'person' : 'people'}</span>
              <button className="app-header__room-copy" onClick={handleCopyInvite}>
                {inviteCopied ? 'Copied' : 'Copy invite'}
              </button>
            </div>
          )}
          <div className="app-header__status">
            <span
              className={`status-dot status-dot--${connectionStatus}`}
              aria-label={`Connection: ${connectionStatus}`}
            />
            <span className="app-header__status-text">{connectionStatus}</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        {showCamera && (
          <section className="app-main__camera" aria-label="Camera view">
            <div className="app-main__camera-stack">
              <CameraView
                onFrame={handleFrame}
                onDiagnostic={addLog}
                onDetectionStateChange={handleDetectionStateChange}
                isActive={isStarted}
                isProcessing={isProcessing && currentMode === 'signing'}
                showLandmarks={showLandmarks}
                showSuccess={translationSuccess}
                lastTranslation={lastTranslation}
                partialText={partialText}
              />
              {activeRoom && (
                <div className="room-presence">
                  <div className="room-presence__tile room-presence__tile--self">
                    <div className="room-presence__label">You</div>
                    <div className="room-presence__name">{activeRoom.participantName}</div>
                    <div className="room-presence__state">
                      {roomParticipants.find((participant) => participant.participantId === activeRoom.participantId)?.activity ?? 'ready'}
                    </div>
                  </div>
                  {remoteParticipants.length > 0 ? (
                    remoteParticipants.map((participant) => (
                      <div key={participant.participantId} className="room-presence__tile">
                        <div className="room-presence__label">Remote</div>
                        <div className="room-presence__name">{participant.participantName}</div>
                        <div className="room-presence__state">{participant.activity}</div>
                      </div>
                    ))
                  ) : (
                    <div className="room-presence__tile room-presence__tile--waiting">
                      <div className="room-presence__label">Remote</div>
                      <div className="room-presence__name">Waiting for someone to join</div>
                      <div className="room-presence__state">idle</div>
                    </div>
                  )}
                </div>
              )}
              {showDebugLog && <DebugLog entries={debugEntries} />}
            </div>
          </section>
        )}

        <section className="app-main__transcript" aria-label="Conversation transcript">
          <TranscriptPanel />
        </section>
      </main>

      <footer className="app-footer">
        <ModeToggle currentMode={currentMode} onModeChange={handleModeChange} />
        <div className="app-footer__actions">
          {currentMode === 'signing' && (
            <>
              {bufferedSignFrames > 0 && !isProcessing && (
                <span className="sign-buffer-status" aria-live="polite">
                  {settings.handsDownSegmentation
                    ? handsVisible
                      ? `Phrase capture ${bufferedSignFrames}/${MIN_SIGN_FRAMES} • keep signing`
                      : bufferedSignFrames >= MIN_SIGN_FRAMES
                        ? 'Hands down detected • finalizing phrase...'
                        : `Phrase capture ${bufferedSignFrames}/${MIN_SIGN_FRAMES}`
                    : bufferedSignFrames >= MIN_SIGN_FRAMES
                      ? 'Pause to auto-interpret...'
                      : `Signing ${bufferedSignFrames}/${MIN_SIGN_FRAMES}`}
                </span>
              )}
              {isProcessing && (
                <span className="sign-buffer-status sign-buffer-status--processing" aria-live="polite">
                  Interpreting...
                </span>
              )}
            </>
          )}
          <button
            className={`control-icon-button ${showLandmarks ? 'control-icon-button--active' : ''}`}
            onClick={() => setShowLandmarks((v) => !v)}
            aria-label={showLandmarks ? 'Hide hand detection' : 'Show hand detection'}
            title={showLandmarks ? 'Hide hand detection' : 'Show hand detection'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
              <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13" />
            </svg>
          </button>
          <button
            className={`control-icon-button ${settingsOpen ? 'control-icon-button--active' : ''}`}
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Open settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            className={`control-icon-button ${showDebugLog ? 'control-icon-button--active' : ''}`}
            onClick={() => setShowDebugLog((value) => !value)}
            aria-label={showDebugLog ? 'Hide activity log' : 'Show activity log'}
            title={showDebugLog ? 'Hide activity log' : 'Show activity log'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16" />
              <path d="M4 12h10" />
              <path d="M4 18h7" />
            </svg>
          </button>
          <MuteButton isMuted={isMuted} onToggle={toggleMute} />
          {currentMode === 'listening' && (
            <Button
              variant={isMicCapturing ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleToggleListeningCapture}
            >
              {isMicCapturing ? 'Stop Listening' : 'Start Listening'}
            </Button>
          )}
          {currentMode === 'signing' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleInterpretSign}
              disabled={!canInterpretSign}
              title="Force interpret now"
            >
              Interpret Now
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleStop}>
            End Session
          </Button>
        </div>
      </footer>

      {listenStatus && (
        <div
          className={`listen-status listen-status--${listenStatus.tone}`}
          aria-live="polite"
        >
          <span className="listen-status__dot" />
          <span>{listenStatus.label}</span>
        </div>
      )}

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {isSpeaking && (
        <div className="speaking-indicator" aria-live="polite">
          Speaking...
        </div>
      )}

      {messages.length === 0 && isStarted && !isProcessing && (
        <div className="onboarding-tip" aria-live="polite">
          <p>
            {activeRoom
              ? `Share room ${activeRoom.roomId} so someone else can join, then sign or speak to start the shared transcript.`
              : 'Sign to the camera — keep your hands up for the full phrase, then lower them to finalize. Or switch to Listen Mode for speech-to-text.'}
          </p>
        </div>
      )}
    </div>
  );
}
