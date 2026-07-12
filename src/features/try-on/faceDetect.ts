// On-device face detection for try-on face compositing (feature 010).
//
// Pipeline (mirrors src/features/measurements/poseEstimate.ts exactly):
//   expo-image-manipulator scales the photo uniformly (long side → 128) →
//   jpeg-js decodes to RGBA → letterbox-padded into a 128×128 RGB tensor →
//   MediaPipe BlazeFace (short-range) → SSD anchor decode → best-scoring face
//   → 4 keypoints (eyes, nose, mouth) in SOURCE-IMAGE normalised coords.
//
// Every step is wrapped in try/catch → returns null on any failure so the
// caller (faceComposite.ts) degrades gracefully to the raw generated image.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

export interface Pt { x: number; y: number }

export interface FaceLandmarks {
  rightEye: Pt;
  leftEye: Pt;
  nose: Pt;
  mouth: Pt;
  /** Detection confidence 0..1 (post-sigmoid). */
  score: number;
}

const MODEL_SIZE = 128;
const SCORE_THRESHOLD = 0.5;

// CALIBRATION-PENDING: BlazeFace short-range's float32 input is normalised
// either to [0,1] or to [-1,1] depending on the exact model export. We try
// [0,1] first (NORMALIZE_TO_UNIT=true); if on-device testing shows the model
// never detects a face, flip this to false to use `pixel/127.5 - 1` instead.
const NORMALIZE_TO_UNIT = true;

// ── Model loading (lazy, cached — mirrors poseEstimate.loadModel) ────────────

let _facePromise: Promise<TensorflowModel> | null = null;

export function loadFaceModel(): Promise<TensorflowModel> {
  if (!_facePromise) {
    _facePromise = loadTensorflowModel(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../../assets/models/face-detector.tflite') as number
    ).catch((err: unknown) => {
      _facePromise = null; // allow retry
      return Promise.reject(err);
    });
  }
  return _facePromise;
}

// ── JPEG decode (same as poseEstimate) ────────────────────────────────────────

function decodeJpegBase64(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// ── BlazeFace short-range anchors (896 total) ─────────────────────────────────
//
// Feature maps: stride 8 → 16x16 grid x 2 anchors = 512; stride 16 → 8x8 grid
// x 6 anchors = 384. Total 896, generated stride-8 block first (matches the
// order MediaPipe's SsdAnchorsCalculator emits them in, which is the order
// the model's flat output tensor expects).
interface Anchor { cx: number; cy: number }

function buildAnchors(): Anchor[] {
  const anchors: Anchor[] = [];
  const strideConfigs: Array<{ stride: number; anchorsPerCell: number }> = [
    { stride: 8, anchorsPerCell: 2 },
    { stride: 16, anchorsPerCell: 6 },
  ];
  for (const { stride, anchorsPerCell } of strideConfigs) {
    const gridSize = MODEL_SIZE / stride; // 16 then 8
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const cx = (gx + 0.5) / gridSize;
        const cy = (gy + 0.5) / gridSize;
        for (let a = 0; a < anchorsPerCell; a++) {
          anchors.push({ cx, cy });
        }
      }
    }
  }
  return anchors; // 16*16*2 + 8*8*6 = 512 + 384 = 896
}

let _anchors: Anchor[] | null = null;
function getAnchors(): Anchor[] {
  if (!_anchors) _anchors = buildAnchors();
  return _anchors;
}

function sigmoid(x: number): number {
  const clamped = Math.max(-100, Math.min(100, x));
  return 1 / (1 + Math.exp(-clamped));
}

// ── Public: detect the best-scoring face in a photo ───────────────────────────

/**
 * Detect a single face in `photoUri` and return 4 landmarks (both eyes, nose,
 * mouth) in SOURCE-IMAGE normalised coords (0..1, letterbox undone — same
 * convention as poseEstimate's `display` coords). Returns null on any failure
 * (model missing, decode error, no face above threshold, native error).
 */
export async function detectFace(
  photoUri: string,
  origW?: number,
  origH?: number,
): Promise<FaceLandmarks | null> {
  try {
    const model = await loadFaceModel();

    // 0. Resolve source dimensions (probe with a no-op manipulate if needed).
    let sW = origW, sH = origH;
    if (!sW || !sH || !isFinite(sW) || !isFinite(sH)) {
      const probe = await manipulateAsync(photoUri, []);
      sW = probe.width;
      sH = probe.height;
    }

    // 1. Scale uniformly so the LONG side is MODEL_SIZE; letterbox-pad the rest.
    const scale = MODEL_SIZE / Math.max(sW, sH);
    const tW = Math.max(1, Math.min(MODEL_SIZE, Math.round(sW * scale)));
    const tH = Math.max(1, Math.min(MODEL_SIZE, Math.round(sH * scale)));

    const resized = await manipulateAsync(
      photoUri,
      [{ resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;

    const img = decodeJpegBase64(resized.base64);
    const pixelCount = MODEL_SIZE * MODEL_SIZE;

    const offX = (MODEL_SIZE - img.width) >> 1;
    const offY = (MODEL_SIZE - img.height) >> 1;

    // 2. Build the [1,128,128,3] input tensor (float32 vs uint8, same branch
    //    pattern as poseEstimate/silhouette).
    const inputDataType = model.inputs[0]?.dataType ?? 'float32';
    const isFloat = inputDataType === 'float32';
    const input: Uint8Array | Float32Array = isFloat
      ? new Float32Array(pixelCount * 3)
      : new Uint8Array(pixelCount * 3);

    for (let y = 0; y < img.height; y++) {
      const dy = y + offY;
      if (dy < 0 || dy >= MODEL_SIZE) continue;
      for (let x = 0; x < img.width; x++) {
        const dx = x + offX;
        if (dx < 0 || dx >= MODEL_SIZE) continue;
        const src = (y * img.width + x) * 4;
        const dst = (dy * MODEL_SIZE + dx) * 3;
        if (isFloat) {
          if (NORMALIZE_TO_UNIT) {
            input[dst]     = img.data[src]     / 255;
            input[dst + 1] = img.data[src + 1] / 255;
            input[dst + 2] = img.data[src + 2] / 255;
          } else {
            input[dst]     = img.data[src]     / 127.5 - 1;
            input[dst + 1] = img.data[src + 1] / 127.5 - 1;
            input[dst + 2] = img.data[src + 2] / 127.5 - 1;
          }
        } else {
          input[dst]     = img.data[src];
          input[dst + 1] = img.data[src + 1];
          input[dst + 2] = img.data[src + 2];
        }
      }
    }

    // 3. Run inference. BlazeFace short-range outputs two tensors:
    //    regressors [1,896,16] and classificators [1,896,1]. Order in
    //    `model.runSync` output follows the model's own output order — try
    //    both slots defensively by checking each tensor's flat length.
    const outputs = model.runSync([input]);
    if (!outputs || outputs.length < 2) return null;

    const anchors = getAnchors();
    const expectedReg = anchors.length * 16;
    const expectedCls = anchors.length * 1;

    let regressors: ArrayLike<number> | null = null;
    let classificators: ArrayLike<number> | null = null;
    for (const out of outputs) {
      if (!out) continue;
      if (out.length === expectedReg) regressors = out as unknown as ArrayLike<number>;
      else if (out.length === expectedCls) classificators = out as unknown as ArrayLike<number>;
    }
    if (!regressors || !classificators) return null;

    // 4. Decode: find the single highest-scoring anchor (argmax). We only
    //    need one face for try-on (single subject), so a full NMS pass isn't
    //    necessary — taking the best-scoring detection is sufficient.
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const score = sigmoid(classificators[i] as number);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestScore < SCORE_THRESHOLD) return null;

    const anchor = anchors[bestIdx];
    const regBase = bestIdx * 16;

    // Keypoint k (0..5) at reg indices 4+2k, 4+2k+1, in 128-px units.
    // Order: 0=right eye, 1=left eye, 2=nose tip, 3=mouth centre, 4=right ear, 5=left ear.
    const kp = (k: number): { x: number; y: number } => {
      const dx = (regressors as ArrayLike<number>)[regBase + 4 + 2 * k] as number;
      const dy = (regressors as ArrayLike<number>)[regBase + 4 + 2 * k + 1] as number;
      return {
        x: anchor.cx + dx / MODEL_SIZE,
        y: anchor.cy + dy / MODEL_SIZE,
      };
    };

    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    // Undo the letterbox: (v*128 - offset) / contentDim → source-image normalised.
    const toDisplay = (p: { x: number; y: number }): Pt => ({
      x: clamp01((p.x * MODEL_SIZE - offX) / img.width),
      y: clamp01((p.y * MODEL_SIZE - offY) / img.height),
    });

    return {
      rightEye: toDisplay(kp(0)),
      leftEye: toDisplay(kp(1)),
      nose: toDisplay(kp(2)),
      mouth: toDisplay(kp(3)),
      score: bestScore,
    };
  } catch {
    // Model file missing, decode failure, or native error → degrade to null.
    return null;
  }
}
