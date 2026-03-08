const TARGET_SAMPLE_RATE = 16000;

export function encodeAudioChunk(audioData: Float32Array, sampleRate: number): string {
  const normalized =
    sampleRate === TARGET_SAMPLE_RATE ? audioData : resampleTo16k(audioData, sampleRate);
  const pcm16 = float32ToPCM16(normalized);
  return arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
}

function resampleTo16k(audioData: Float32Array, sampleRate: number): Float32Array {
  if (audioData.length === 0) {
    return audioData;
  }

  const ratio = sampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(audioData.length / ratio));
  const result = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, audioData.length - 1);
    const weight = position - leftIndex;
    result[i] = audioData[leftIndex] * (1 - weight) + audioData[rightIndex] * weight;
  }

  return result;
}

function float32ToPCM16(float32: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function playAudioData(
  base64Audio: string,
  audioContext: AudioContext
): Promise<void> {
  const arrayBuffer = base64ToArrayBuffer(base64Audio);

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => resolve();
    });
  } catch {
    console.warn('Failed to decode audio, trying as raw PCM');
    const pcmData = new Int16Array(arrayBuffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x8000;
    }

    const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000);
    audioBuffer.copyToChannel(floatData, 0);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => resolve();
    });
  }
}
