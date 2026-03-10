import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

let handLandmarker: HandLandmarker | null = null;
let loading = false;

const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

async function getHandLandmarker(): Promise<HandLandmarker> {
  if (handLandmarker) return handLandmarker;
  if (loading) {
    // Wait for in-progress load
    while (loading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return handLandmarker!;
  }

  loading = true;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  });

  loading = false;
  return handLandmarker;
}

export async function initHandDetection(): Promise<void> {
  await getHandLandmarker();
}

export interface HandFrameSummary {
  handCount: number;
  framing: 'good' | 'hands_not_visible' | 'too_close' | 'too_far';
}

export async function detectHands(video: HTMLVideoElement): Promise<HandFrameSummary> {
  const detector = await getHandLandmarker();
  if (video.readyState < 2) {
    return { handCount: 0, framing: 'hands_not_visible' };
  }

  const result = detector.detectForVideo(video, performance.now());
  const landmarks = result.landmarks ?? [];
  if (landmarks.length === 0) {
    return { handCount: 0, framing: 'hands_not_visible' };
  }

  let largestArea = 0;
  for (const hand of landmarks) {
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;

    for (const point of hand) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    largestArea = Math.max(largestArea, (maxX - minX) * (maxY - minY));
  }

  if (largestArea < 0.015) {
    return { handCount: landmarks.length, framing: 'too_far' };
  }
  if (largestArea > 0.35) {
    return { handCount: landmarks.length, framing: 'too_close' };
  }

  return { handCount: landmarks.length, framing: 'good' };
}

export function detectAndDraw(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): void {
  if (!handLandmarker || video.readyState < 2) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Match canvas size to video display size
  const rect = video.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const result = handLandmarker.detectForVideo(video, performance.now());

  if (!result.landmarks || result.landmarks.length === 0) return;

  // Mirror the canvas to match the mirrored video
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  const drawingUtils = new DrawingUtils(ctx);

  for (const landmarks of result.landmarks) {
    // Draw connections (skeleton lines)
    drawingUtils.drawConnectors(landmarks, HAND_CONNECTIONS, {
      color: '#00FF88',
      lineWidth: 3,
    });

    // Draw landmark points
    drawingUtils.drawLandmarks(landmarks, {
      color: '#FF4444',
      lineWidth: 1,
      radius: 4,
    });
  }

  ctx.restore();
}

export function disposeHandDetection(): void {
  if (handLandmarker) {
    handLandmarker.close();
    handLandmarker = null;
  }
}
