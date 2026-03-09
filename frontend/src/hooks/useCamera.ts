import { useRef, useState, useCallback, useEffect } from 'react';
import { CameraService } from '../services/CameraService.ts';
import { captureFrame, calculateBrightness, detectMotion, resetMotionDetection } from '../utils/frameEncoder.ts';
import { initHandDetection, detectHands } from '../utils/handDetection.ts';
import type { CameraStatus } from '../types/index.ts';

export function useCamera(onFrame?: (frameData: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraService = useRef(new CameraService());
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisInFlightRef = useRef(false);
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
      setStatus((s) => ({ ...s, isActive: true, hasPermission: true }));
    } catch (err) {
      console.error('Camera access denied:', err);
      setStatus((s) => ({ ...s, isActive: false, hasPermission: false }));
    }
  }, []);

  const startFrameCapture = useCallback(
    (fps: number = 5) => {
      if (frameIntervalRef.current) return;

      const intervalMs = 1000 / fps;
      frameIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || analysisInFlightRef.current) return;
        analysisInFlightRef.current = true;

        try {
          const handSummary = await detectHands(videoRef.current);
          if (handSummary.framing !== 'good') {
            setStatus((s) => ({
              ...s,
              framing: handSummary.framing,
            }));
            return;
          }

          const hasMotion = detectMotion(videoRef.current);
          if (!hasMotion) return;

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
    [onFrame]
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
    setStatus((s) => ({ ...s, isActive: false, framing: 'good' }));
  }, [stopFrameCapture]);

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
