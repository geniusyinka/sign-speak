import { encodeAudioChunk } from '../utils/audioEncoder.ts';

const MIN_SPEECH_RMS = 0.012;
const SPEECH_HOLD_FRAMES = 4;

export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private onChunk: ((data: string) => void) | null = null;
  private speechHoldFrames = 0;

  async startCapture(onAudioChunk: (base64Data: string) => void): Promise<void> {
    if (this.audioContext?.state === 'closed') {
      this.audioContext = null;
    }

    this.onChunk = onAudioChunk;
    this.audioContext ??= new AudioContext();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.sink = this.audioContext.createGain();
    this.sink.gain.value = 0;

    // Use ScriptProcessor for simplicity (AudioWorklet is better but more complex to set up)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const rms = calculateRms(inputData);
      if (rms >= MIN_SPEECH_RMS) {
        this.speechHoldFrames = SPEECH_HOLD_FRAMES;
      } else if (this.speechHoldFrames > 0) {
        this.speechHoldFrames -= 1;
      }
      if (this.speechHoldFrames <= 0) {
        return;
      }
      const encoded = encodeAudioChunk(inputData, event.inputBuffer.sampleRate);
      this.onChunk?.(encoded);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.sink);
    this.sink.connect(this.audioContext.destination);
  }

  stopCapture(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.processor = null;
    this.source = null;
    this.sink = null;
    this.mediaStream = null;
    this.onChunk = null;
    this.speechHoldFrames = 0;
  }

  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async close(): Promise<void> {
    this.stopCapture();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}

function calculateRms(audioData: Float32Array): number {
  let total = 0;
  for (let i = 0; i < audioData.length; i += 1) {
    total += audioData[i] * audioData[i];
  }
  return Math.sqrt(total / audioData.length);
}
