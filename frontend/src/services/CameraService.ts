export class CameraService {
  private stream: MediaStream | null = null;

  async startCapture(videoElement: HTMLVideoElement): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    });

    videoElement.srcObject = this.stream;
    await videoElement.play();
  }

  stopCapture(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  get isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }
}
