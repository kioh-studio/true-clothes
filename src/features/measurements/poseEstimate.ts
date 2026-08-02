// On-device pose estimation for the body-measurement AI capture path.
//
// Pipeline (all on-device, no remote upload):
//   expo-image-manipulator scales the photo uniformly (long side → model input
//   size) → jpeg-js decodes to RGBA → letterbox-padded into a square RGB
//   tensor (aspect ratio preserved; see `inferKeypointsInSquare`) → MoveNet →
//   17 keypoints (y, x, score) normalized 0..1 in the padded square.
//
// TWO passes, TWO different models:
//   `estimateKeypoints` — MoveNet LIGHTNING (192×192) on the FULL frame. Runs
//     every ~1.2 s in the live poll loop (app/measurements-scan.tsx) — cheap
//     enough for a tight cadence, coarse enough that it's only a first guess.
//   `refineKeypoints`   — BlazePose HEAVY (256×256, 33-landmark MediaPipe
//     model) on a tight CROP around the person located by the pass-1
//     Lightning keypoints. Cropping means the person fills more of the
//     model's input pixels than they did in the uncropped frame — that's the
//     main lever for precision at a fixed input size — and BlazePose Heavy is
//     itself a materially higher-capacity model than Lightning at the same
//     crop tightness. Runs once, at capture time only, on at most a few
//     buffered frames (see finish()'s latency guard in measurements-scan.tsx)
//     — too slow for the live poll cadence.
//
// BlazePose Heavy replaced MoveNet Thunder (2026-07-12) for three reasons: 33
// landmarks instead of 17 (including the heel/toe-tip points the new
// floor-line height/inseam estimate in landmarksToMeasurements.ts needs — see
// that file), an explicit per-landmark visibility score instead of a single
// coarse confidence, and a materially larger/more accurate model. The two
// models do NOT share a decode path — see `inferKeypointsInSquare` vs
// `inferBlazePoseInSquare` below — because their input normalisation and
// output tensor shapes are both completely different; forcing them into one
// shared function would need more branching than just writing two.
//
// Every step is wrapped in try/catch → returns null on any failure so the
// caller degrades gracefully (refineKeypoints falls back to the pass-1
// keypoints; estimateKeypoints falls back to manual entry).
//
// PRIVACY: The caller is responsible for deleting the temp photo URI via
// FileSystem.deleteAsync after this function returns (success or null).

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { personCropRect, cropSquareToFullSquare, longSideResize } from './cropMath';
import { loadModelWithGpuFallback } from './modelLoad';
import { decodeBlazePoseLandmarks, findOutputIndexByLength, BLAZEPOSE_LANDMARKS_LENGTH } from './blazePoseDecode';

// ── Keypoint type ─────────────────────────────────────────────────────────────

export interface Keypoint {
  /**
   * Landmark name (camelCase, e.g. "leftShoulder"). Pass-1 (Lightning) always
   * returns exactly the 17 COCO names in `KEYPOINT_NAMES` below. A
   * successful refine pass (BlazePose Heavy) returns those SAME 17 names
   * PLUS 4 new ones — "leftHeel", "rightHeel", "leftFootIndex",
   * "rightFootIndex" — see `BLAZEPOSE_LANDMARK_MAP` in blazePoseDecode.ts.
   * Every downstream consumer looks landmarks up BY NAME and simply ignores
   * names it doesn't recognise, so a 17- or 21-length array both work
   * everywhere without special-casing (see aggregateFrames.ts's
   * `medianKeypoints` for the one place this needed an explicit check).
   */
  name: string;
  /** Normalized x coordinate 0..1 (left→right) */
  x: number;
  /** Normalized y coordinate 0..1 (top→bottom) */
  y: number;
  /** Confidence score 0..1 */
  score: number;
}

// MoveNet SinglePose 17-keypoint ordering (COCO topology). Pass-1 (Lightning,
// full-frame) ONLY — the refine pass's own landmark→name mapping lives in
// blazePoseDecode.ts's `BLAZEPOSE_LANDMARK_MAP`.
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

// Model input sizes — Lightning (pass 1, full frame) and BlazePose Heavy
// (pass 2, crop refinement). Both happen to be square inputs at these sizes;
// nothing else about the two models' input/output conventions is shared.
const MODEL_SIZE = 192;
const BLAZEPOSE_SIZE = 256;

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
 * can retry (e.g. after a dev-build reinstall). Stays on the plain default
 * (CPU) delegate — Lightning is cheap enough already that a GPU delegate's
 * extra failure surface (see modelLoad.ts) isn't worth it for the live poll
 * loop.
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

let _blazePosePromise: Promise<TensorflowModel> | null = null;

/**
 * Lazy-load BlazePose Heavy (33-landmark, float32, 256×256 input, MediaPipe
 * Apache-2.0) once; cache the promise the same way `loadModel` does. Tries
 * the platform's GPU delegate first, falling back to CPU on any load failure
 * (see `loadModelWithGpuFallback` in modelLoad.ts — some devices/drivers
 * don't support a given model on their GPU delegate, and that must degrade
 * gracefully, never break the pipeline). Only ever invoked by
 * `refineKeypoints` — the live poll loop never loads this model, so devices
 * that never open the scan screen never pay for it.
 */
export function loadBlazePoseModel(): Promise<TensorflowModel> {
  if (!_blazePosePromise) {
    _blazePosePromise = loadModelWithGpuFallback(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../../assets/models/blazepose-heavy.tflite') as number
    ).then((m) => {
      // DEVICE-VERIFY (see backlog.md §I): confirm these logged shapes match
      // the spec this module was written against — input [1,256,256,3]
      // float32, and SOME output of length 195 (landmarks) + SOME output of
      // length 1 (poseflag). If a real device reports different shapes,
      // `inferBlazePoseInSquare` below degrades to null (defensive length
      // checks), it does NOT crash — but the refine pass will silently never
      // fire, so this log is the first place to look.
      if (__DEV__) {
        console.log(`[BLAZEPOSE] loaded delegate=${m.delegate}`);
        console.log(`[BLAZEPOSE] inputs=${JSON.stringify(m.inputs)}`);
        console.log(`[BLAZEPOSE] outputs=${JSON.stringify(m.outputs)}`);
      }
      return m;
    }).catch((err: unknown) => {
      _blazePosePromise = null; // allow retry
      return Promise.reject(err);
    });
  }
  return _blazePosePromise;
}

// ── JPEG decode ───────────────────────────────────────────────────────────────

/** Decode a base64-encoded JPEG to raw RGBA pixels. Hermes provides atob. */
function decodeJpegBase64(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// ── Shared inference core (Lightning only — see inferBlazePoseInSquare below
//    for the refine pass, which is deliberately NOT sharing this function) ──

/** One model's keypoint output, still in ITS OWN letterboxed-square space
 *  (0..1 of `modelSize`) — the caller maps this to whatever public space it
 *  needs (full-square for Lightning's `display`, full-square via cropMath
 *  for BlazePose's crop-square output). Shared RETURN SHAPE between
 *  `inferKeypointsInSquare` and `inferBlazePoseInSquare` even though the two
 *  functions that produce it don't share implementation. */
interface SquareInference {
  keypoints: Keypoint[];
  /** Letterbox offsets + the resized (pre-pad) image dims, in MODEL pixels —
   *  needed to undo the padding for a display-space projection. */
  offX: number;
  offY: number;
  imgWidth: number;
  imgHeight: number;
}

/**
 * Decode an already-resized (long side → `modelSize`) JPEG, letterbox-pad it
 * into a `modelSize`×`modelSize` tensor, run `model` (MoveNet Lightning) on
 * it, and decode the 17 output keypoints — all in the model's own
 * letterboxed-square space. Used ONLY by the pass-1 full-frame estimate
 * (`estimateKeypoints`) — the refine pass has its own dedicated
 * `inferBlazePoseInSquare` below, because BlazePose's input normalisation and
 * output tensor shape are both different enough that sharing this function
 * would need more branching than just writing two.
 *
 * IMPORTANT — float input convention: MoveNet Lightning (float variant)
 * expects float32 input in range 0..255 — the SAME raw byte values as the
 * uint8 branch, NOT divided by 255. The model normalizes internally (see the
 * MoveNet model card). Dividing by 255 here would halve the model's
 * effective input range; this was previously DEAD CODE for the quantised
 * int8 Lightning asset (which always reports `dataType: 'uint8'`) but would
 * be silently WRONG for a float32 asset.
 *
 * ⚠ BlazePose Heavy (the refine-pass model, see `inferBlazePoseInSquare`)
 * uses the OPPOSITE convention — [0,1], i.e. pixel/255 — same as the
 * person-segmentation models in silhouette.ts. Mixing these two conventions
 * up between the two inference functions is the single easiest bug to
 * introduce when touching this file.
 */
function inferKeypointsInSquare(
  model: TensorflowModel,
  resizedBase64: string,
  modelSize: number,
): SquareInference | null {
  const img = decodeJpegBase64(resizedBase64);
  const pixelCount = modelSize * modelSize;

  // Content centred, rest padded with zeros. MoveNet int8 takes uint8 RGB;
  // a float32 variant takes the SAME 0..255 values, just as floats. Buffers
  // are zero-initialised → padding = black either way.
  const inputDataType = model.inputs[0]?.dataType ?? 'uint8';
  const isFloat = inputDataType === 'float32';
  const input: Uint8Array | Float32Array = isFloat
    ? new Float32Array(pixelCount * 3)
    : new Uint8Array(pixelCount * 3);

  const offX = (modelSize - img.width)  >> 1;
  const offY = (modelSize - img.height) >> 1;

  for (let y = 0; y < img.height; y++) {
    const dy = y + offY;
    if (dy < 0 || dy >= modelSize) continue;
    for (let x = 0; x < img.width; x++) {
      const dx = x + offX;
      if (dx < 0 || dx >= modelSize) continue;
      const src = (y * img.width + x) * 4;
      const dst = (dy * modelSize + dx) * 3;
      // Raw byte values for BOTH dtypes — see the doc comment above.
      input[dst]     = img.data[src];
      input[dst + 1] = img.data[src + 1];
      input[dst + 2] = img.data[src + 2];
    }
  }

  // Run inference synchronously (JSI — no async bridge overhead).
  // Output shape: [1, 1, 17, 3] → flat array of 51 floats.
  // Each triplet: [y, x, score] normalised 0..1.
  const outputs = model.runSync([input]);
  const raw = outputs[0];
  if (!raw || raw.length < 17 * 3) return null;

  const keypoints: Keypoint[] = [];
  for (let i = 0; i < 17; i++) {
    const base = i * 3;
    const sx = raw[base + 1] as number; // x in 0..1 of the modelSize square
    const sy = raw[base]     as number; // y in 0..1 of the modelSize square
    const score = raw[base + 2] as number;
    keypoints.push({ name: KEYPOINT_NAMES[i], x: sx, y: sy, score });
  }

  return { keypoints, offX, offY, imgWidth: img.width, imgHeight: img.height };
}

/**
 * BlazePose Heavy counterpart to `inferKeypointsInSquare` — decode an
 * already-resized (long side → `modelSize`) JPEG, letterbox-pad it into a
 * `modelSize`×`modelSize` tensor, run `model` on it, and decode the 21 named
 * keypoints (17 shared COCO names + 4 new heel/toe names — see
 * blazePoseDecode.ts) in the model's own letterboxed-square space.
 *
 * NOT shared with `inferKeypointsInSquare` — three real differences make a
 * shared function more confusing than two separate ones:
 *   1. Input normalisation: BlazePose expects float32 RGB in **[0,1]**
 *      (pixel/255) — the OPPOSITE of MoveNet's raw-0..255-as-float
 *      convention documented above.
 *   2. Output shape/count: BlazePose exposes several output tensors
 *      (landmarks [1,195], poseflag [1,1], segmentation, heatmap, world
 *      landmarks [1,117]) instead of MoveNet's single [1,1,17,3] tensor —
 *      tensors are located by their RUNTIME LENGTH (see
 *      `findOutputIndexByLength`), never by a hardcoded index, since a
 *      model re-export could reorder them.
 *   3. An extra overall gate: `poseflag` (sigmoid) says whether BlazePose
 *      itself thinks the crop contains a usable pose at all, independent of
 *      any individual landmark's visibility score.
 *
 * VERIFY ON DEVICE (see backlog.md §I): the input/output tensor
 * shapes actually observed for `assets/models/blazepose-heavy.tflite` via
 * the `__DEV__` log in `loadBlazePoseModel` above. Every assumption here
 * (input convention, output lengths, landmark index map) is written against
 * the published BlazePose Heavy model card, not verified against this exact
 * asset on a real device by this session.
 */
function inferBlazePoseInSquare(
  model: TensorflowModel,
  resizedBase64: string,
  modelSize: number,
): SquareInference | null {
  const img = decodeJpegBase64(resizedBase64);
  const pixelCount = modelSize * modelSize;

  // BlazePose is float32-only in practice, but branch defensively the same
  // way inferKeypointsInSquare does in case a quantised variant ever ships.
  const inputDataType = model.inputs[0]?.dataType ?? 'float32';
  const isFloat = inputDataType === 'float32';
  const input: Uint8Array | Float32Array = isFloat
    ? new Float32Array(pixelCount * 3)
    : new Uint8Array(pixelCount * 3);

  const offX = (modelSize - img.width)  >> 1;
  const offY = (modelSize - img.height) >> 1;

  for (let y = 0; y < img.height; y++) {
    const dy = y + offY;
    if (dy < 0 || dy >= modelSize) continue;
    for (let x = 0; x < img.width; x++) {
      const dx = x + offX;
      if (dx < 0 || dx >= modelSize) continue;
      const src = (y * img.width + x) * 4;
      const dst = (dy * modelSize + dx) * 3;
      if (isFloat) {
        // [0,1] normalisation — the OPPOSITE of MoveNet's convention above.
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
  const landmarksIdx = findOutputIndexByLength(outputs, BLAZEPOSE_LANDMARKS_LENGTH);
  const poseflagIdx  = findOutputIndexByLength(outputs, 1);
  if (landmarksIdx < 0 || poseflagIdx < 0) return null; // unexpected model shape — degrade to null, not a crash

  // Cast: react-native-fast-tflite's output element type is a union that
  // technically includes BigInt64Array/BigUint64Array (not ArrayLike<number>)
  // — in practice a BlazePose landmark/poseflag tensor is always float32.
  const landmarks = outputs[landmarksIdx] as Float32Array;
  const keypoints = decodeBlazePoseLandmarks(landmarks, outputs[poseflagIdx][0] as number, modelSize);
  if (!keypoints) return null; // poseflag gate — BlazePose itself saw no usable pose in this crop

  return { keypoints, offX, offY, imgWidth: img.width, imgHeight: img.height };
}

// ── Public: estimate keypoints from a photo URI (Lightning, full frame) ──────

/**
 * Resize `photoUri` to a 192×192 MoveNet Lightning input and return 17
 * keypoints.
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
    const { width: tW, height: tH } = longSideResize(sW, sH, MODEL_SIZE);

    const resized = await manipulateAsync(
      photoUri,
      [{ resize: { width: tW, height: tH } }],
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return null;

    // 2-5. Decode, letterbox, infer, and map to named keypoints (shared core).
    const result = inferKeypointsInSquare(model, resized.base64, MODEL_SIZE);
    if (!result) return null;

    // Display space: undo the letterbox (pixel-in-square → source-image
    // normalised coord) for drawing the skeleton overlay on the live preview.
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const display: Keypoint[] = result.keypoints.map((k) => ({
      name: k.name,
      x: clamp01((k.x * MODEL_SIZE - result.offX) / result.imgWidth),
      y: clamp01((k.y * MODEL_SIZE - result.offY) / result.imgHeight),
      score: k.score,
    }));

    return { keypoints: result.keypoints, display };
  } catch {
    // Model file missing, decode failure, or native error → degrade to manual.
    return null;
  }
}

// ── Public: refine keypoints from a tight crop (BlazePose, capture-time only) ─

/**
 * Second-pass keypoint refinement, run once at capture time (never in the
 * live poll loop — too slow for a ~1.2 s cadence, and capped to a few
 * buffered frames even at capture time, see finish()'s latency guard in
 * measurements-scan.tsx): crop tightly around the person located by the
 * pass-1 Lightning keypoints, then run BlazePose Heavy (33-landmark,
 * higher-capacity than Lightning) on just that crop. Cropping means the
 * person occupies more of the model's input pixels than they did in the full
 * uncropped frame — the main lever for keypoint precision at a fixed input
 * size — and BlazePose Heavy is itself more accurate than Lightning at the
 * same crop tightness.
 *
 * `sW`/`sH` are the SOURCE (uncropped) frame's pixel dimensions — the same
 * space `pass1Kps` (from `estimateKeypoints`) already live in. The crop
 * margins (`personCropRect`'s 0.18 top / 0.10 bottom / 0.20 sides) were tuned
 * for Thunder but are close enough for BlazePose too — BlazePose's own
 * native pipeline scales the detected person box by ~1.25×, which these
 * margins approximate.
 *
 * Returns a 21-keypoint array on success — the 17 shared COCO names PLUS
 * 'leftHeel' / 'rightHeel' / 'leftFootIndex' / 'rightFootIndex' (new; see
 * blazePoseDecode.ts). z (depth) is available on the model but intentionally
 * NOT used yet — future work, once something downstream can consume a depth
 * signal.
 *
 * Returns `null` (caller falls back to `pass1Kps`) when:
 * - `personCropRect` finds no usable crop (degenerate bbox, too small, or
 *   cropping wouldn't meaningfully help — see cropMath.ts),
 * - the BlazePose asset is missing or fails to load,
 * - the crop/resize/decode/inference pipeline fails,
 * - the model's own `poseflag` gate says there's no usable pose in the crop, or
 * - the model returns an unexpected output shape (see `inferBlazePoseInSquare`).
 *
 * Every failure mode is non-fatal, matching `estimateKeypoints`'s
 * degrade-to-null contract.
 */
export async function refineKeypoints(
  photoUri: string,
  sW: number,
  sH: number,
  pass1Kps: Keypoint[],
): Promise<Keypoint[] | null> {
  try {
    const cropRect = personCropRect(pass1Kps, sW, sH);
    if (!cropRect) return null;

    const model = await loadBlazePoseModel();

    const { width: tW, height: tH } = longSideResize(cropRect.width, cropRect.height, BLAZEPOSE_SIZE);
    const cropped = await manipulateAsync(
      photoUri,
      [
        { crop: cropRect },
        { resize: { width: tW, height: tH } },
      ],
      { base64: true, format: SaveFormat.JPEG, compress: 0.9 },
    );
    if (!cropped.base64) return null;

    const result = inferBlazePoseInSquare(model, cropped.base64, BLAZEPOSE_SIZE);
    if (!result) return null;

    // Map every keypoint from crop-square space to the shared FULL-square
    // space so the refined pose is a drop-in replacement for the pass-1
    // keypoints everywhere downstream (silhouette bands, measurement math).
    // Scores pass through unchanged — BlazePose's own confidence, not blended
    // with pass 1's.
    return result.keypoints.map((k) => {
      const { u, v } = cropSquareToFullSquare(k.x, k.y, cropRect, sW, sH);
      return { name: k.name, x: u, y: v, score: k.score };
    });
  } catch {
    return null;
  }
}
