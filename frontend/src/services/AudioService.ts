import { encodeAudioChunk } from '../utils/audioEncoder.ts';

export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onChunk: ((data: string) => void) | null = null;

  async startCapture(onAudioChunk: (base64Data: string) => void): Promise<void> {
    this.onChunk = onAudioChunk;
    this.audioContext = new AudioContext({ sampleRate: 16000 });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Use ScriptProcessor for simplicity (AudioWorklet is better but more complex to set up)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const encoded = encodeAudioChunk(inputData, this.audioContext!.sampleRate);
      this.onChunk?.(encoded);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stopCapture(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.processor = null;
    this.source = null;
    this.mediaStream = null;
    this.onChunk = null;
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
