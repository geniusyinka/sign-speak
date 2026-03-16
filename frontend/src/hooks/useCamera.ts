import { useRef, useState, useCallback, useEffect } from 'react';
import { CameraService } from '../services/CameraService.ts';
import { captureFrame, calculateBrightness, detectMotion, resetMotionDetection } from '../utils/frameEncoder.ts';
import { initHandDetection, detectHands } from '../utils/handDetection.ts';
import type { CameraStatus, SignDetectionState } from '../types/index.ts';
import type { LogEntry } from '../components/CameraView/DebugLog.tsx';

export function useCamera(
  onFrame?: (frameData: string) => void,
  onDiagnostic?: (message: string, type?: LogEntry['type']) => void,
  onDetectionStateChange?: (state: SignDetectionState) => void
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraService = useRef(new CameraService());
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisInFlightRef = useRef(false);
  const lastFramingRef = useRef<CameraStatus['framing']>('good');
  const lastMotionRef = useRef(false);
  const lastHandsVisibleRef = useRef(false);
  const [status, setStatus] = useState<CameraStatus>({
    isActive: false,
    hasPermission: false,
    brightness: 'good',
    framing: 'good',
  });

  const startCapture = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      resetMotionDetection();
      await initHandDetection();
      await cameraService.current.startCapture(videoRef.current);
      onDiagnostic?.('Camera ready; hand detection initialized');
      setStatus((s) => ({ ...s, isActive: true, hasPermission: true }));
    } catch (err) {
      console.error('Camera access denied:', err);
      onDiagnostic?.('Camera access denied', 'error');
      setStatus((s) => ({ ...s, isActive: false, hasPermission: false }));
    }
  }, [onDiagnostic]);

  const startFrameCapture = useCallback(
    (fps: number = 5) => {
      if (frameIntervalRef.current) return;

      const intervalMs = 1000 / fps;
      frameIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || analysisInFlightRef.current) return;
        analysisInFlightRef.current = true;

        try {
          const handSummary = await detectHands(videoRef.current);
          const handsVisible = handSummary.handCount > 0;
          if (handsVisible !== lastHandsVisibleRef.current) {
            lastHandsVisibleRef.current = handsVisible;
            onDetectionStateChange?.({
              handsVisible,
              hasMotion: lastMotionRef.current,
              handCount: handSummary.handCount,
              framing: handSummary.framing,
            });
          }
          if (handSummary.framing !== 'good') {
            if (lastFramingRef.current !== handSummary.framing) {
              lastFramingRef.current = handSummary.framing;
              onDiagnostic?.(
                handSummary.framing === 'hands_not_visible'
                  ? 'No hands detected'
                  : handSummary.framing === 'too_far'
                    ? `Hands detected but too far (${handSummary.handCount})`
                    : `Hands too close to camera (${handSummary.handCount})`
              );
            }
            setStatus((s) => ({
              ...s,
              framing: handSummary.framing,
            }));
            return;
          }
          if (lastFramingRef.current !== 'good') {
            lastFramingRef.current = 'good';
            onDiagnostic?.(`Hand framing good (${handSummary.handCount} hand${handSummary.handCount === 1 ? '' : 's'})`);
          }

          const hasMotion = detectMotion(videoRef.current);
          if (hasMotion !== lastMotionRef.current) {
            lastMotionRef.current = hasMotion;
            onDiagnostic?.(hasMotion ? 'Signing motion detected' : 'Motion paused');
            onDetectionStateChange?.({
              handsVisible,
              hasMotion,
              handCount: handSummary.handCount,
              framing: handSummary.framing,
            });
          }

          const brightness = calculateBrightness(videoRef.current);
          setStatus((s) => ({
            ...s,
            brightness: brightness < 50 ? 'too_dark' : brightness > 200 ? 'too_bright' : 'good',
            framing: handSummary.framing,
          }));

          const frame = captureFrame(videoRef.current);
          if (frame && onFrame) {
            onFrame(frame);
          }
        } finally {
          analysisInFlightRef.current = false;
        }
      }, intervalMs);
    },
    [onDetectionStateChange, onDiagnostic, onFrame]
  );

  const stopFrameCapture = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    analysisInFlightRef.current = false;
  }, []);

  const stopCapture = useCallback(() => {
    stopFrameCapture();
    cameraService.current.stopCapture();
    resetMotionDetection();
    lastFramingRef.current = 'good';
    lastMotionRef.current = false;
    lastHandsVisibleRef.current = false;
    onDiagnostic?.('Camera capture stopped');
    setStatus((s) => ({ ...s, isActive: false, framing: 'good' }));
  }, [stopFrameCapture, onDiagnostic]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    videoRef,
    status,
    startCapture,
    startFrameCapture,
    stopFrameCapture,
    stopCapture,
  };
}
