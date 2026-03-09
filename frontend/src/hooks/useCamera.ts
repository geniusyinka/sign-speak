import { useRef, useState, useCallback, useEffect } from 'react';
import { CameraService } from '../services/CameraService.ts';
import { captureFrame, calculateBrightness, detectMotion, resetMotionDetection } from '../utils/frameEncoder.ts';
import type { CameraStatus } from '../types/index.ts';

export function useCamera(onFrame?: (frameData: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraService = useRef(new CameraService());
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      frameIntervalRef.current = setInterval(() => {
        if (!videoRef.current) return;

        const hasMotion = detectMotion(videoRef.current);
        if (!hasMotion) return;

        const brightness = calculateBrightness(videoRef.current);
        setStatus((s) => ({
          ...s,
          brightness: brightness < 50 ? 'too_dark' : brightness > 200 ? 'too_bright' : 'good',
        }));

        const frame = captureFrame(videoRef.current);
        if (frame && onFrame) {
          onFrame(frame);
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
  }, []);

  const stopCapture = useCallback(() => {
    stopFrameCapture();
    cameraService.current.stopCapture();
    resetMotionDetection();
    setStatus((s) => ({ ...s, isActive: false }));
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
