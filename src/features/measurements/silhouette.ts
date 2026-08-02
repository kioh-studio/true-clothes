// On-device person segmentation for the body-measurement AI capture path.
//
// WHY: pose keypoints sit at skeletal JOINTS — inside the body outline — so
// widths derived from keypoint spans run systematically narrow (a 1m76 man
// scanned at "shoulder 33 cm"), and the waist has no keypoint at all. This
// module measures the REAL body-contour width at the anatomical heights the
// pose provides:
//   shoulder → widest row around the shoulder line (deltoid outline)
//   chest    → row at ~25% of the shoulder→hip span
//   waist    → NARROWEST row in the mid-torso band (the natural waist)
//   hip      → WIDEST row in the hip/seat band
//
// TWO segmentation models, tried in order (2026-07-12):
//   MODNet (`assets/models/modnet.tflite`, portrait matting, tried FIRST) —
//     a soft ALPHA matte (continuous 0..1, true sub-pixel edges — hair, loose
//     fabric) instead of a coarse binary-ish person/background split, so the
//     contour edges `runWidthAt`'s sub-pixel interpolation finds are more
//     trustworthy. Runs at 512×512, NCHW input (see `fillNCHWFloat` in
//     silhouetteMath.ts — a completely different tensor layout from every
//     other model in this feature).
//   MediaPipe Selfie Segmenter (`assets/models/selfie-segmenter.tflite`,
//     256×256, HWC) — the ORIGINAL model this feature shipped with, now the
//     FALLBACK when MODNet fails to load, reports an unexpected output
//     shape, or produces a degenerate (near-empty or near-full) mask.
//
// TWO variants share BOTH segmentation models:
//   `estimateSilhouette`        — FULL FRAME (long side → the model's input
//     size, letterboxed). Widths come back in the shared full-square space
//     (same convention as poseEstimate keypoints) — no extra conversion
//     needed by the caller.
//   `estimateSilhouetteCropped` — a CROP around the person (the same crop
//     rect the BlazePose pose-refinement pass computed), resized the same
//     way. A tighter crop means more of the model's input pixels land on the
//     body instead of background, sharpening the contour. Widths come back
//     in CROP-square space — the caller (measurements-scan.tsx finish())
//     converts through cropMath's Lc/L scale factor before merging with
//     other frames or full-frame results.
//
// PRIVACY: same contract as poseEstimate — everything on-device, the caller
// deletes the temp photo. Any failure returns null and the caller falls back
// to the keypoint-span heuristics (previous behaviour).

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { longSideResize, type CropRect } from './cropMath';
import { loadModelWithGpuFallback } from './modelLoad';
import { fillNCHWFloat, type SilhouetteMask } from './silhouetteMath';

export { extractWidths, maskVerticalExtent, S, fillNCHWFloat, eraseDisk, bandExtremeWidthRow } from './silhouetteMath';
export type { SilhouetteMask, SilhouetteWidths, BandExtreme } from './silhouetteMath';

const SEG_SIZE = 256;   // selfie segmenter (fallback) — unchanged from before MODNet.
const MATTE_SIZE = 512; // MODNet (primary).

// ── Model loading (lazy, cached — mirrors poseEstimate) ──────────────────────

let _segPromise: Promise<TensorflowModel> | null = null;

/**
 * Lazy-load the selfie-segmenter FALLBACK model. Stays on the plain default
 * (CPU) delegate — it's cheap enough already that a GPU delegate's extra
 * failure surface (see modelLoad.ts) isn't worth it for a model that only
 * runs when the preferred MODNet path has already failed.
 */
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

let _mattePromise: Promise<TensorflowModel> | null = null;

/**
 * Lazy-load MODNet (portrait matting, LiteRT community build, Apache-2.0)
 * once; cache the promise the same way `loadSegmenterModel` does. Tries the
 * platform's GPU delegate first, falling back to CPU on any load failure —
 * see `loadModelWithGpuFallback` in modelLoad.ts.
 */
export function loadMatteModel(): Promise<TensorflowModel> {
  if (!_mattePromise) {
    _mattePromise = loadModelWithGpuFallback(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../../assets/models/modnet.tflite') as number
    ).then((m) => {
      // DEVICE-VERIFY (see backlog.md §I): confirm the logged shapes match
      // [1,3,512,512] float32 in / [1,1,512,512] float32 alpha out. If a real
      // device reports something else, `inferMatteMask` below degrades to
      // null (defensive length check) and every caller falls back to the
      // selfie segmenter — it does NOT crash — but this log is the first
      // place to look if MODNet silently never contributes.
      if (__DEV__) {
        console.log(`[MODNET] loaded delegate=${m.delegate}`);
        console.log(`[MODNET] inputs=${JSON.stringify(m.inputs)}`);
        console.log(`[MODNET] outputs=${JSON.stringify(m.outputs)}`);
      }
      return m;
    }).catch((err: unknown) => {
      _mattePromise = null; // allow retry
      return Promise.reject(err);
    });
  }
  return _mattePromise;
}

// ── JPEG decode (same as poseEstimate) ────────────────────────────────────────

function decodeJpegBase64(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// ── Selfie-segmenter inference core (HWC, fallback path) ──────────────────────

/**
 * Decode an already-resized (long side → SEG_SIZE) JPEG, letterbox-pad it
 * into a SEG_SIZE×SEG_SIZE tensor, run the selfie segmenter, and return the
 * person-probability mask — in WHATEVER letterboxed-square space the
 * caller's resize was relative to (full-frame square for `estimateSilhouette`,
 * crop square for `estimateSilhouetteCropped`). Shared so both variants stay
 * byte-for-byte consistent; only the manipulateAsync call that produces
 * `base64` differs.
 *
 * NOTE: unlike poseEstimate's MoveNet, the selfie segmenter genuinely expects
 * float32 input normalised to [0,1] — the /255 division below is correct for
 * THIS model family. HWC (interleaved) layout — see `inferMatteMask` below
 * for MODNet's completely different NCHW (channel-planar) layout; the two
 * are NOT interchangeable and must not be merged into one fill loop.
 */
function inferSilhouetteMask(model: TensorflowModel, base64: string): SilhouetteMask | null {
  const img = decodeJpegBase64(base64);
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
}

// ── MODNet inference core (NCHW, primary path) ────────────────────────────────

/**
 * Decode an already-resized (long side → MATTE_SIZE) JPEG, letterbox-pad it
 * into a MATTE_SIZE×MATTE_SIZE NCHW tensor via `fillNCHWFloat` (see
 * silhouetteMath.ts — a completely different channel-planar layout from
 * `inferSilhouetteMask`'s HWC fill above; do NOT reuse that loop for this
 * model), run MODNet, and return the alpha matte as a `SilhouetteMask`.
 * MODNet's declared output [1,1,512,512] is already a single-channel,
 * row-major alpha map at the SAME size as the input, so — unlike the selfie
 * segmenter's multi-channel output — no channel selection is needed; the raw
 * output IS the mask, directly. `silhouetteMath.ts`'s mask-consuming
 * functions (`runWidthAt`, `maskVerticalExtent`, etc.) are size-agnostic (see
 * their doc comments), so a 512-sized mask works everywhere a 256-sized one
 * did, without any caller-side change.
 */
function inferMatteMask(model: TensorflowModel, base64: string): SilhouetteMask | null {
  const img = decodeJpegBase64(base64);
  const pixelCount = MATTE_SIZE * MATTE_SIZE;

  const offX = (MATTE_SIZE - img.width)  >> 1;
  const offY = (MATTE_SIZE - img.height) >> 1;
  const input = fillNCHWFloat(img.data, img.width, img.height, MATTE_SIZE, offX, offY);

  const outputs = model.runSync([input]);
  const raw = outputs[0];
  if (!raw || raw.length < pixelCount) return null; // unexpected output shape — caller falls back

  const data = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) data[i] = raw[i] as number;
  return { data, size: MATTE_SIZE };
}

/**
 * A mask that's almost entirely background or almost entirely foreground is
 * a degenerate MODNet result (bad crop, lighting the model wasn't trained
 * for, an unexpected output the length check above didn't catch) — not a
 * real alpha matte of a person against a background. Caller treats this the
 * same as a load/shape failure: fall back to the selfie segmenter.
 */
function isDegenerateMask(mask: SilhouetteMask): boolean {
  let sum = 0;
  for (let i = 0; i < mask.data.length; i++) sum += mask.data[i];
  const mean = sum / mask.data.length;
  return mean < 0.02 || mean > 0.9;
}

/** Full-frame MODNet attempt — null on ANY failure (load, shape, degenerate output). */
async function tryMatteFullFrame(photoUri: string, sW: number, sH: number): Promise<SilhouetteMask | null> {
  try {
    const model = await loadMatteModel();
    const { width: tW, height: tH } = longSideResize(sW, sH, MATTE_SIZE);
    const resized = await manipulateAsync(
      photoUri,
      [{ resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;
    const mask = inferMatteMask(model, resized.base64);
    return mask && !isDegenerateMask(mask) ? mask : null;
  } catch {
    return null;
  }
}

/** Cropped MODNet attempt — null on ANY failure (load, shape, degenerate output). */
async function tryMatteCropped(photoUri: string, cropRect: CropRect): Promise<SilhouetteMask | null> {
  try {
    const model = await loadMatteModel();
    const { width: tW, height: tH } = longSideResize(cropRect.width, cropRect.height, MATTE_SIZE);
    const resized = await manipulateAsync(
      photoUri,
      [{ crop: cropRect }, { resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;
    const mask = inferMatteMask(model, resized.base64);
    return mask && !isDegenerateMask(mask) ? mask : null;
  } catch {
    return null;
  }
}

// ── Segmentation inference — full frame ───────────────────────────────────────

/**
 * Run person segmentation on `photoUri`: tries MODNet FIRST (see the module
 * doc comment), falling back to the selfie segmenter on any MODNet failure
 * (load error, shape mismatch, or a degenerate alpha mean — see
 * `isDegenerateMask`). Returns the mask in the WINNING model's own
 * letterboxed square (512 for MODNet, 256 for the fallback — every
 * mask-consuming function in silhouetteMath.ts is size-agnostic), or null if
 * BOTH fail. Letterbox convention matches poseEstimate exactly (uniform
 * scale, centred, zero padding) so mask coordinates and pose keypoints live
 * in the same normalised space regardless of which model produced the mask.
 */
export async function estimateSilhouette(
  photoUri: string,
  origW?: number,
  origH?: number,
): Promise<SilhouetteMask | null> {
  try {
    let sW = origW, sH = origH;
    if (!sW || !sH || !isFinite(sW) || !isFinite(sH)) {
      const probe = await manipulateAsync(photoUri, []);
      sW = probe.width;
      sH = probe.height;
    }

    const matte = await tryMatteFullFrame(photoUri, sW, sH);
    if (matte) return matte;

    // Fallback: the original selfie-segmenter path, unchanged.
    const model = await loadSegmenterModel();
    const { width: tW, height: tH } = longSideResize(sW, sH, SEG_SIZE);
    const resized = await manipulateAsync(
      photoUri,
      [{ resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;

    return inferSilhouetteMask(model, resized.base64);
  } catch {
    return null;
  }
}

// ── Segmentation inference — cropped (capture-time refinement) ───────────────

/**
 * Cropped variant of `estimateSilhouette`: crop to `cropRect` (the SAME rect
 * the BlazePose pose-refinement pass computed via `personCropRect`) before
 * resizing/segmenting, so more of the model's input lands on the person
 * instead of background/floor. Tries MODNet first, falls back to the selfie
 * segmenter — same policy as the full-frame variant above.
 *
 * `sW`/`sH` are the SOURCE (uncropped) frame's pixel dimensions — used only
 * to defensively clamp `cropRect` in case it came from a different frame's
 * dimensions than `photoUri`'s.
 *
 * Returns the mask in CROP-square normalised space — NOT the shared
 * full-square space `estimateSilhouette` returns. The caller must convert any
 * width/extent derived from this mask through `cropSquareLengthToFullSquare`
 * (cropMath.ts) before merging with full-frame results.
 */
export async function estimateSilhouetteCropped(
  photoUri: string,
  sW: number,
  sH: number,
  cropRect: CropRect,
): Promise<SilhouetteMask | null> {
  // Defensive clamp — cropRect should already be within [0,sW]x[0,sH] (it
  // came from personCropRect against these same dims), but never hand
  // manipulateAsync a rect that overflows the actual source image.
  const width  = Math.min(cropRect.width,  Math.max(1, sW - cropRect.originX));
  const height = Math.min(cropRect.height, Math.max(1, sH - cropRect.originY));
  const safeRect: CropRect = { originX: cropRect.originX, originY: cropRect.originY, width, height };

  const matte = await tryMatteCropped(photoUri, safeRect);
  if (matte) return matte;

  try {
    // Fallback: the original selfie-segmenter path, unchanged.
    const model = await loadSegmenterModel();
    const { width: tW, height: tH } = longSideResize(safeRect.width, safeRect.height, SEG_SIZE);

    const resized = await manipulateAsync(
      photoUri,
      [{ crop: safeRect }, { resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;

    return inferSilhouetteMask(model, resized.base64);
  } catch {
    return null;
  }
}
