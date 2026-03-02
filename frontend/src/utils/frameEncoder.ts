const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const JPEG_QUALITY = 0.65;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d')!;
  }
  return { canvas, ctx: ctx! };
}

export function captureFrame(video: HTMLVideoElement): string | null {
  if (video.readyState < 2) return null;

  const { canvas: c, ctx: context } = getCanvas();
  context.drawImage(video, 0, 0, c.width, c.height);

  const dataUrl = c.toDataURL('image/jpeg', JPEG_QUALITY);
  return dataUrl.split(',')[1];
}

export function calculateBrightness(video: HTMLVideoElement): number {
  const { canvas: c, ctx: context } = getCanvas();
  context.drawImage(video, 0, 0, c.width, c.height);

  const imageData = context.getImageData(0, 0, c.width, c.height);
  const data = imageData.data;
  let sum = 0;

  for (let i = 0; i < data.length; i += 16) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  return sum / (data.length / 16);
}

let previousFrameData: Uint8ClampedArray | null = null;

export function detectMotion(video: HTMLVideoElement): boolean {
  const { canvas: c, ctx: context } = getCanvas();
  context.drawImage(video, 0, 0, c.width, c.height);

  const imageData = context.getImageData(0, 0, c.width, c.height);

  if (!previousFrameData) {
    previousFrameData = new Uint8ClampedArray(imageData.data);
    return true;
  }

  let diffSum = 0;
  const step = 16;
  let count = 0;

  for (let i = 0; i < imageData.data.length; i += step) {
    diffSum += Math.abs(imageData.data[i] - previousFrameData[i]);
    count++;
  }

  previousFrameData = new Uint8ClampedArray(imageData.data);

  const avgDiff = diffSum / count;
  return avgDiff > 10;
}
