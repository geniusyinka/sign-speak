import { useRef, useState, useCallback, useEffect } from 'react';
import { AudioService } from '../services/AudioService.ts';

export function useMicrophone(onAudioChunk?: (data: string) => void) {
  const audioService = useRef(new AudioService());
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const startCapture = useCallback(async () => {
    if (!onAudioChunk) return;

    try {
      await audioService.current.startCapture(onAudioChunk);
      setIsCapturing(true);
      setHasPermission(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setHasPermission(false);
    }
  }, [onAudioChunk]);

  const stopCapture = useCallback(() => {
    audioService.current.stopCapture();
    setIsCapturing(false);
  }, []);

  const getAudioContext = useCallback(() => {
    return audioService.current.getAudioContext();
  }, []);

  useEffect(() => {
    return () => {
      audioService.current.close();
    };
  }, []);

  return {
    isCapturing,
    hasPermission,
    startCapture,
    stopCapture,
    getAudioContext,
  };
}
