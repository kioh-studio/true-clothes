// On-device person segmentation for the body-measurement AI capture path.
//
// WHY: pose keypoints sit at skeletal JOINTS — inside the body outline — so
// widths derived from keypoint spans run systematically narrow (a 1m76 man
// scanned at "shoulder 33 cm"), and the waist has no keypoint at all. This
// module runs MediaPipe Selfie Segmenter on the captured frame and measures
// the REAL body-contour width at the anatomical heights the pose provides:
//   shoulder → widest row around the shoulder line (deltoid outline)
//   chest    → row at ~25% of the shoulder→hip span
//   waist    → NARROWEST row in the mid-torso band (the natural waist)
//   hip      → WIDEST row in the hip/seat band
//
// All widths are returned in the same letterboxed-square normalised units as
// poseEstimate keypoints (uniform scale + centre padding, identical convention),
// so `landmarksToMeasurements` can convert them with its cm-per-unit scale.
//
// PRIVACY: same contract as poseEstimate — everything on-device, the caller
// deletes the temp photo. Any failure returns null and the caller falls back
// to the keypoint-span heuristics (previous behaviour).

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { extractWidths, S, type SilhouetteMask, type SilhouetteWidths } from './silhouetteMath';

export { extractWidths, S } from './silhouetteMath';
export type { SilhouetteMask, SilhouetteWidths } from './silhouetteMath';

const SEG_SIZE = 256;

// ── Model loading (lazy, cached — mirrors poseEstimate) ──────────────────────

let _segPromise: Promise<TensorflowModel> | null = null;

export function loadSegmenterModel(): Promise<TensorflowModel> {
  if (!_segPromise) {
    _segPromise = loadTensorflowModel(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../../assets/models/selfie-segmenter.tflite') as number
    ).catch((err: unknown) => {
      _segPromise = null; // allow retry
      return Promise.reject(err);
    });
  }
  return _segPromise;
}

// ── JPEG decode (same as poseEstimate) ────────────────────────────────────────

function decodeJpegBase64(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// ── Segmentation inference ────────────────────────────────────────────────────

/**
 * Run person segmentation on `photoUri`. Returns the person-probability mask in
 * the SEG_SIZE letterboxed square, or null on any failure. Letterbox convention
 * matches poseEstimate exactly (uniform scale, centred, zero padding) so mask
 * coordinates and pose keypoints live in the same normalised space.
 */
export async function estimateSilhouette(
  photoUri: string,
  origW?: number,
  origH?: number,
): Promise<SilhouetteMask | null> {
  try {
    const model = await loadSegmenterModel();

    let sW = origW, sH = origH;
    if (!sW || !sH || !isFinite(sW) || !isFinite(sH)) {
      const probe = await manipulateAsync(photoUri, []);
      sW = probe.width;
      sH = probe.height;
    }

    const scale = SEG_SIZE / Math.max(sW, sH);
    const tW = Math.max(1, Math.min(SEG_SIZE, Math.round(sW * scale)));
    const tH = Math.max(1, Math.min(SEG_SIZE, Math.round(sH * scale)));

    const resized = await manipulateAsync(
      photoUri,
      [{ resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;

    const img = decodeJpegBase64(resized.base64);
    const pixelCount = SEG_SIZE * SEG_SIZE;

    // Selfie Segmenter takes float32 RGB normalised to [0,1]; keep a uint8
    // branch for robustness against quantised variants.
    const inputDataType = model.inputs[0]?.dataType ?? 'float32';
    const isFloat = inputDataType === 'float32';
    const input: Uint8Array | Float32Array = isFloat
      ? new Float32Array(pixelCount * 3)
      : new Uint8Array(pixelCount * 3);

    const offX = (SEG_SIZE - img.width)  >> 1;
    const offY = (SEG_SIZE - img.height) >> 1;

    for (let y = 0; y < img.height; y++) {
      const dy = y + offY;
      if (dy < 0 || dy >= SEG_SIZE) continue;
      for (let x = 0; x < img.width; x++) {
        const dx = x + offX;
        if (dx < 0 || dx >= SEG_SIZE) continue;
        const src = (y * img.width + x) * 4;
        const dst = (dy * SEG_SIZE + dx) * 3;
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

    const outputs = model.runSync([input]);
    const raw = outputs[0];
    if (!raw || raw.length < pixelCount) return null;

    // Output is [1, 256, 256, C]: C=1 → person confidence; C=2 → (bg, person).
    const channels = Math.round(raw.length / pixelCount);
    if (channels < 1) return null;
    const data = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      data[i] = raw[i * channels + (channels - 1)] as number;
    }
    return { data, size: SEG_SIZE };
  } catch {
    return null;
  }
}
