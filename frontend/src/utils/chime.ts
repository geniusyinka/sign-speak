let audioCtx: AudioContext | null = null;

export function playSuccessChime(): void {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    const now = audioCtx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(523, now, 0.08);       // C5
    playTone(659, now + 0.08, 0.08); // E5
  } catch {
    // AudioContext not available — no-op
  }
}
