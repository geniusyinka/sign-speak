import { useRef, useState, useCallback } from 'react';
import { playAudioData } from '../utils/audioEncoder.ts';

export function useSpeech() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playNext = useCallback(async () => {
    if (isPlayingRef.current || queueRef.current.length === 0) return;

    isPlayingRef.current = true;
    setIsSpeaking(true);

    while (queueRef.current.length > 0) {
      const audioData = queueRef.current.shift()!;
      try {
        const ctx = getAudioContext();
        await playAudioData(audioData, ctx, (source) => {
          activeSourceRef.current = source;
        });
      } catch (err) {
        console.error('Failed to play audio:', err);
      }
    }

    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, [getAudioContext]);

  const speak = useCallback(
    (audioData: string) => {
      if (isMuted) return;
      queueRef.current.push(audioData);
      playNext();
    },
    [isMuted, playNext]
  );

  /** Fallback: use browser's built-in speech synthesis when no audio data from server */
  const speakText = useCallback(
    (text: string) => {
      if (isMuted) return;
      if (!('speechSynthesis' in window)) return;

      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      if (next) {
        queueRef.current = [];
        activeSourceRef.current?.stop();
        activeSourceRef.current = null;
        isPlayingRef.current = false;
        setIsSpeaking(false);
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        window.speechSynthesis?.cancel();
      }
      return next;
    });
  }, []);

  return {
    isSpeaking,
    isMuted,
    speak,
    speakText,
    toggleMute,
  };
}
