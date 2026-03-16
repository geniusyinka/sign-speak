import { useEffect, useRef, useCallback } from 'react';
import { useCamera } from '../../hooks/useCamera.ts';
import { CameraOverlay } from './CameraOverlay.tsx';
import { CameraGuide } from './CameraGuide.tsx';
import { TranslationOverlay } from './TranslationOverlay.tsx';
import { initHandDetection, detectAndDraw, disposeHandDetection } from '../../utils/handDetection.ts';
import type { SignDetectionState } from '../../types/index.ts';
import type { LogEntry } from './DebugLog.tsx';

interface CameraViewProps {
  onFrame: (frameData: string) => void;
  onDiagnostic?: (message: string, type?: LogEntry['type']) => void;
  isActive: boolean;
  isProcessing: boolean;
  showLandmarks: boolean;
  showSuccess?: boolean;
  lastTranslation: string | null;
  partialText: string | null;
  onDetectionStateChange?: (state: SignDetectionState) => void;
}

export function CameraView({ onFrame, onDiagnostic, isActive, isProcessing, showLandmarks, showSuccess, lastTranslation, partialText, onDetectionStateChange }: CameraViewProps) {
  const { videoRef, status, startCapture, startFrameCapture, stopFrameCapture, stopCapture } =
    useCamera(onFrame, onDiagnostic, onDetectionStateChange);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (isActive) {
      startCapture().then(() => startFrameCapture(8));
    } else {
      stopCapture();
    }
  }, [isActive, startCapture, startFrameCapture, stopCapture]);

  useEffect(() => {
    return () => {
      stopFrameCapture();
      stopCapture();
    };
  }, [stopFrameCapture, stopCapture]);

  // Hand landmark detection loop
  const runDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !showLandmarks) return;
    detectAndDraw(videoRef.current, canvasRef.current);
    rafRef.current = requestAnimationFrame(runDetection);
  }, [showLandmarks, videoRef]);

  useEffect(() => {
    if (showLandmarks && isActive) {
      initHandDetection().then(() => {
        rafRef.current = requestAnimationFrame(runDetection);
      });
    } else {
      cancelAnimationFrame(rafRef.current);
      // Clear canvas when toggled off
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [showLandmarks, isActive, runDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeHandDetection();
  }, []);

  return (
    <div className="camera-view">
      <div
        className={`camera-view__container ${
          showSuccess
            ? 'camera-view__container--success'
            : isProcessing
              ? 'camera-view__container--processing'
              : status.isActive
                ? 'camera-view__container--ready'
                : ''
        }`}
      >
        <video
          ref={videoRef}
          className="camera-view__video"
          autoPlay
          muted
          playsInline
          aria-label="Camera preview showing your signing"
        />
        <canvas
          ref={canvasRef}
          className="camera-view__landmarks"
          aria-hidden="true"
        />
        <CameraOverlay status={status} isProcessing={isProcessing} />
        <TranslationOverlay text={lastTranslation} partial={partialText} />
        {!status.isActive && <CameraGuide />}
      </div>
    </div>
  );
}
