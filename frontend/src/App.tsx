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

export function App() {
  const MIN_SIGN_FRAMES = 8;
  const AUTO_SUBMIT_PAUSE_MS = 700;
  const [isStarted, setIsStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [partialText, setPartialText] = useState<string | null>(null);
  const [bufferedSignFrames, setBufferedSignFrames] = useState(0);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [debugEntries, setDebugEntries] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const bufferResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      sendAudioChunk(data);
    },
    [sendAudioChunk]
  );

  const { startCapture: startMic, stopCapture: stopMic } = useMicrophone(handleAudioChunk);
  const canInterpretSign =
    connectionStatus === 'connected' && !isProcessing && bufferedSignFrames >= MIN_SIGN_FRAMES;

  // Track pending translation text for browser TTS fallback
  const pendingTTSRef = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);

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
            const source = msg.source ?? 'spoken';
            addMessage({
              type: source,
              text: msg.text,
              speaker: source === 'signed' ? 'user' : 'other',
              confidence: msg.confidence,
            });

            // In signing mode, speak the translation aloud for the hearing person.
            // Set a fallback timer: if no server audio arrives within 300ms, use browser TTS.
            // In listening mode, text is displayed for the deaf user — no TTS needed.
            if (source === 'signed') {
              if (pendingTTSRef.current) {
                clearTimeout(pendingTTSRef.current.timer);
              }
              const timer = setTimeout(() => {
                speakText(msg.text!);
                pendingTTSRef.current = null;
              }, 300);
              pendingTTSRef.current = { text: msg.text, timer };
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
  }, [onMessage, addMessage, speak, speakText, setIsProcessing]);

  const handleStart = useCallback(() => {
    connect();
    setIsStarted(true);
    setCurrentMode('signing');
  }, [connect, setCurrentMode]);

  const handleStop = useCallback(() => {
    disconnect();
    stopMic();
    setIsStarted(false);
    setBufferedSignFrames(0);
    setCurrentMode('idle');
  }, [disconnect, stopMic, setCurrentMode]);

  const handleModeChange = useCallback(
    (mode: 'signing' | 'listening' | 'idle') => {
      if (mode === currentMode) return;
      sendEndTurn();
      setCurrentMode(mode);
      setBufferedSignFrames(0);

      if (mode === 'listening') {
        startMic();
      } else {
        stopMic();
      }
    },
    [currentMode, sendEndTurn, setCurrentMode, startMic, stopMic]
  );

  const handleInterpretSign = useCallback(() => {
    if (bufferedSignFrames < MIN_SIGN_FRAMES) return;
    addLog(`Submitting sign clip with ${bufferedSignFrames} buffered frame(s)`);
    setIsProcessing(true);
    sendEndTurn();
  }, [bufferedSignFrames, sendEndTurn, setIsProcessing, addLog]);

  const frameCountRef = useRef(0);
  const bufferedSignFramesRef = useRef(0);

  // Keep ref in sync with state so the auto-submit timer closure reads the latest count
  useEffect(() => {
    bufferedSignFramesRef.current = bufferedSignFrames;
  }, [bufferedSignFrames]);

  const handleFrame = useCallback(
    (frameData: string) => {
      if (currentMode === 'signing' && !isProcessing) {
        frameCountRef.current++;
        if (bufferResetTimerRef.current) {
          clearTimeout(bufferResetTimerRef.current);
        }
        setBufferedSignFrames((count) => Math.min(count + 1, 24));

        // When motion pauses, auto-submit if we have enough frames
        bufferResetTimerRef.current = setTimeout(() => {
          bufferResetTimerRef.current = null;
          if (bufferedSignFramesRef.current >= MIN_SIGN_FRAMES) {
            addLog(`Auto-submitting sign clip (${bufferedSignFramesRef.current} frames, pause detected)`);
            setIsProcessing(true);
            sendEndTurn();
          } else {
            // Not enough frames — just reset
            setBufferedSignFrames(0);
          }
        }, AUTO_SUBMIT_PAUSE_MS);

        if (frameCountRef.current % 5 === 1) {
          addLog(`Frame sent (${Math.round(frameData.length * 0.75 / 1024)}KB)`, 'frame');
        }
        sendVideoFrame(frameData);
      }
    },
    [currentMode, isProcessing, sendVideoFrame, sendEndTurn, setIsProcessing, addLog]
  );

  useEffect(() => {
    return () => {
      if (bufferResetTimerRef.current) {
        clearTimeout(bufferResetTimerRef.current);
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

  return (
    <div className={`app ${settings.highContrast ? 'app--high-contrast' : ''}`}>
      <header className="app-header">
        <h1 className="app-header__title">SignSpeak</h1>
        <div className="app-header__status">
          <span
            className={`status-dot status-dot--${connectionStatus}`}
            aria-label={`Connection: ${connectionStatus}`}
          />
          <span className="app-header__status-text">{connectionStatus}</span>
        </div>
      </header>

      <main className="app-main">
        {showCamera && (
          <section className="app-main__camera" aria-label="Camera view">
            <CameraView
              onFrame={handleFrame}
              onDiagnostic={addLog}
              isActive={isStarted}
              isProcessing={isProcessing && currentMode === 'signing'}
              showLandmarks={showLandmarks}
            />
            <DebugLog entries={debugEntries} />
          </section>
        )}

        <section className="app-main__transcript" aria-label="Conversation transcript">
          <TranscriptPanel />
          {partialText && (
            <div className="partial-text" aria-live="polite">
              <span className="partial-text__label">Interpreting:</span> {partialText}
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <ModeToggle currentMode={currentMode} onModeChange={handleModeChange} />
        <div className="app-footer__actions">
          {currentMode === 'signing' && (
            <>
              {bufferedSignFrames > 0 && !isProcessing && (
                <span className="sign-buffer-status" aria-live="polite">
                  {bufferedSignFrames >= MIN_SIGN_FRAMES
                    ? 'Pause to auto-interpret...'
                    : `Signing ${bufferedSignFrames}/${MIN_SIGN_FRAMES}`}
                </span>
              )}
              {isProcessing && (
                <span className="sign-buffer-status sign-buffer-status--processing" aria-live="polite">
                  Interpreting...
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleInterpretSign}
                disabled={!canInterpretSign}
                title="Force interpret now"
              >
                Interpret Now
              </Button>
            </>
          )}
          <button
            className={`landmark-toggle ${showLandmarks ? 'landmark-toggle--active' : ''}`}
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
          <MuteButton isMuted={isMuted} onToggle={toggleMute} />
          <Button variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
          <Button variant="secondary" size="sm" onClick={handleStop}>
            End Session
          </Button>
        </div>
      </footer>

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
            Sign to the camera — interpretation happens automatically when you pause.
            Or switch to Listen Mode for speech-to-text.
          </p>
        </div>
      )}
    </div>
  );
}
