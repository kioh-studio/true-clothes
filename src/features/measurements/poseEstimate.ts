// On-device pose estimation for the body-measurement AI capture path.
//
// Pipeline (all on-device, no remote upload):
//   expo-image-manipulator scales the photo uniformly (long side → 192) →
//   jpeg-js decodes to RGBA → letterbox-padded into a 192×192 RGB tensor
//   (aspect ratio preserved; see estimateKeypoints) → MoveNet →
//   17 keypoints (y, x, score) normalized 0..1 in the padded square.
//
// Every step is wrapped in try/catch → returns null on any failure so the
// caller degrades gracefully to manual entry.
//
// PRIVACY: The caller is responsible for deleting the temp photo URI via
// FileSystem.deleteAsync after this function returns (success or null).

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

// ── Keypoint type ─────────────────────────────────────────────────────────────

export interface Keypoint {
  /** MoveNet landmark name (camelCase, e.g. "leftShoulder") */
  name: string;
  /** Normalized x coordinate 0..1 (left→right) */
  x: number;
  /** Normalized y coordinate 0..1 (top→bottom) */
  y: number;
  /** Confidence score 0..1 */
  score: number;
}

// MoveNet SinglePose 17-keypoint ordering (COCO topology).
const KEYPOINT_NAMES = [
  'nose',           // 0
  'leftEye',        // 1
  'rightEye',       // 2
  'leftEar',        // 3
  'rightEar',       // 4
  'leftShoulder',   // 5
  'rightShoulder',  // 6
  'leftElbow',      // 7
  'rightElbow',     // 8
  'leftWrist',      // 9
  'rightWrist',     // 10
  'leftHip',        // 11
  'rightHip',       // 12
  'leftKnee',       // 13
  'rightKnee',      // 14
  'leftAnkle',      // 15
  'rightAnkle',     // 16
] as const;

// MoveNet Lightning input dimensions.
const MODEL_SIZE = 192;

/** Result of a pose estimate: measurement-space + display-space keypoints. */
export interface PoseResult {
  /**
   * Letterboxed-square (192) normalised coords — x and y share the same
   * real-world unit. Feed these to `keypointsToMeasurements`.
   */
  keypoints: Keypoint[];
  /**
   * Source-image normalised coords (0..1 of the original frame, padding undone).
   * Use these to draw the skeleton overlay on a live camera preview.
   */
  display: Keypoint[];
}

// ── Model loading (lazy, cached) ──────────────────────────────────────────────

let _modelPromise: Promise<TensorflowModel> | null = null;

/**
 * Lazy-load the MoveNet Lightning model once; cache the promise so subsequent
 * calls share the same instance. Resets the cache on error so a later call
 * can retry (e.g. after a dev-build reinstall).
 */
export function loadModel(): Promise<TensorflowModel> {
  if (!_modelPromise) {
    _modelPromise = loadTensorflowModel(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../../assets/models/movenet-lightning.tflite') as number
    ).catch((err: unknown) => {
      _modelPromise = null; // allow retry
      return Promise.reject(err);
    });
  }
  return _modelPromise;
}

// ── JPEG decode ───────────────────────────────────────────────────────────────

/** Decode a base64-encoded JPEG to raw RGBA pixels. Hermes provides atob. */
function decodeJpegBase64(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// ── Public: estimate keypoints from a photo URI ───────────────────────────────

/**
 * Resize `photoUri` to a 192×192 MoveNet input and return 17 keypoints.
 *
 * IMPORTANT — aspect ratio: the image is scaled UNIFORMLY (long side → 192) and
 * letterbox-padded to the square, NOT squashed. Uniform scale is what makes the
 * downstream measurement math valid: it keeps the x and y axes on the same
 * real-world scale, so `landmarksToMeasurements` can derive cm-per-unit from the
 * vertical span and apply it to horizontal widths. Squashing to 192×192 (forcing
 * both axes independently) inflates horizontal widths by origH/origW (~1.3–1.8×
 * for a portrait photo). The padding offset cancels out because every downstream
 * quantity is a *difference* of keypoint coordinates.
 *
 * `origW`/`origH` are the source pixel dimensions (from the image picker asset).
 * When absent/invalid they are probed via a no-op manipulate.
 *
 * Returns `null` on any failure (model missing, decode error, native error —
 * callers additionally gate on per-keypoint score).
 */
export async function estimateKeypoints(
  photoUri: string,
  origW?: number,
  origH?: number,
): Promise<PoseResult | null> {
  try {
    const model = await loadModel();

    // 0. Resolve source dimensions (probe with a no-op manipulate if needed).
    let sW = origW, sH = origH;
    if (!sW || !sH || !isFinite(sW) || !isFinite(sH)) {
      const probe = await manipulateAsync(photoUri, []);
      sW = probe.width;
      sH = probe.height;
    }

    // 1. Scale uniformly so the LONG side is MODEL_SIZE; the short side stays
    //    proportional (≤ MODEL_SIZE) and gets letterbox-padded below.
    const scale = MODEL_SIZE / Math.max(sW, sH);
    const tW = Math.max(1, Math.min(MODEL_SIZE, Math.round(sW * scale)));
    const tH = Math.max(1, Math.min(MODEL_SIZE, Math.round(sH * scale)));

    const resized = await manipulateAsync(
      photoUri,
      [{ resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;

    // 2. Decode RGBA (use the decoded dims as authoritative — manipulate may
    //    round by a pixel).
    const img = decodeJpegBase64(resized.base64);
    const pixelCount = MODEL_SIZE * MODEL_SIZE;

    // 3. Build the [1, 192, 192, 3] input tensor, content centred, rest padded
    //    with zeros. MoveNet Lightning int8 takes uint8 RGB; a float32 variant
    //    is normalised to [0, 1]. Buffers are zero-initialised → padding = black.
    const inputDataType = model.inputs[0]?.dataType ?? 'uint8';
    const isFloat = inputDataType === 'float32';
    const input: Uint8Array | Float32Array = isFloat
      ? new Float32Array(pixelCount * 3)
      : new Uint8Array(pixelCount * 3);

    const offX = (MODEL_SIZE - img.width)  >> 1;
    const offY = (MODEL_SIZE - img.height) >> 1;

    for (let y = 0; y < img.height; y++) {
      const dy = y + offY;
      if (dy < 0 || dy >= MODEL_SIZE) continue;
      for (let x = 0; x < img.width; x++) {
        const dx = x + offX;
        if (dx < 0 || dx >= MODEL_SIZE) continue;
        const src = (y * img.width + x) * 4;
        const dst = (dy * MODEL_SIZE + dx) * 3;
        if (isFloat) {
          input[dst]     = img.data[src]     / 255;
          input[dst + 1] = img.data[src + 1] / 255;
          input[dst + 2] = img.data[src + 2] / 255;
        } else {
          input[dst]     = img.data[src];
          input[dst + 1] = img.data[src + 1];
          input[dst + 2] = img.data[src + 2];
        }
      }
    }

    // 4. Run inference synchronously (JSI — no async bridge overhead).
    //    Output shape: [1, 1, 17, 3] → flat array of 51 floats.
    //    Each triplet: [y, x, score] normalised 0..1.
    const outputs = model.runSync([input]);
    const raw = outputs[0];
    if (!raw || raw.length < 17 * 3) return null;

    // 5. Map flat array to named keypoints (square space) and to display space
    //    (undo the letterbox: pixel-in-square → source-image normalised coord).
    const keypoints: Keypoint[] = [];
    const display: Keypoint[] = [];
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    for (let i = 0; i < 17; i++) {
      const base = i * 3;
      const sx = raw[base + 1] as number; // x in 0..1 of the 192 square
      const sy = raw[base]     as number; // y in 0..1 of the 192 square
      const score = raw[base + 2] as number;
      keypoints.push({ name: KEYPOINT_NAMES[i], x: sx, y: sy, score });
      display.push({
        name: KEYPOINT_NAMES[i],
        x: clamp01((sx * MODEL_SIZE - offX) / img.width),
        y: clamp01((sy * MODEL_SIZE - offY) / img.height),
        score,
      });
    }

    return { keypoints, display };
  } catch {
    // Model file missing, decode failure, or native error → degrade to manual.
    return null;
  }
}
