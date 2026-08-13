// On-device face detection for try-on face compositing (feature 010).
//
// Pipeline (mirrors src/features/measurements/poseEstimate.ts exactly):
//   expo-image-manipulator scales the photo uniformly (long side → 128) →
//   jpeg-js decodes to RGBA → letterbox-padded into a 128×128 RGB tensor →
//   MediaPipe BlazeFace (short-range) → SSD anchor decode → best-scoring face
//   → 4 keypoints (eyes, nose, mouth) in SOURCE-IMAGE normalised coords.
//
// 2-pass detection (try-on fixes, 2026-08-06): BlazeFace short-range runs at
// 128×128, so in a full-length head-to-toe photo the face is only ~8-10px
// after letterboxing — marginal for both the source photo and the generated
// image. When the full-image pass misses or comes back weak, a second pass
// re-runs detection on a crop of the upper portion of the frame (where a
// face lives in a full-length shot) and maps the result back to full-image
// coords. See faceDetectMath.ts for the (pure, jest-tested) crop-mapping and
// pass-selection logic.
//
// Every step is wrapped in try/catch → detectFace() never throws, and
// degrades to null on any failure so existing callers (analyzeFace in
// personal-color) keep working unchanged.
//
// Diagnostics (2026-08-14): `detectFace` alone collapses three very
// different situations into the same `null` — model failed to load, image
// decode failed, or the detector ran fine and found no face. For
// faceComposite.ts, which needs to tell these apart during on-device
// testing, use `detectFaceDetailed` instead — it reports a DetectFailureKind
// (faceDetectMath.ts) on failure while returning the identical landmarks
// shape on success. `detectFace` is now a thin wrapper around it.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import {
  isWeakDetection, mapLandmarksCropToFull, selectFaceDetection, combineFailureKinds, FACE_CROP_REGION,
  type Pt, type FaceBox, type FaceLandmarks, type DetectFailureKind,
} from './faceDetectMath';

export type { Pt, FaceBox, FaceLandmarks, DetectFailureKind };

/** Outcome of `detectFaceDetailed` — same landmarks shape as before on
 *  success; on failure, which DetectFailureKind applied (plus the raw caught
 *  error, if any, for logging — never for control flow). */
export type DetectOutcome =
  | { ok: true; landmarks: FaceLandmarks }
  | { ok: false; failure: DetectFailureKind; error?: unknown };

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

// ── One detection pass over a (possibly cropped) region of the photo ─────────
//
// Returns landmarks normalised to THAT region's own frame (0..1) — when
// `cropPx` is set, the caller is responsible for mapping the result back to
// full-image coords (mapLandmarksCropToFull in faceDetectMath.ts).
//
// Diagnostics (2026-08-14): split into two try/catch stages so a failure can
// be attributed to the right cause — this is a pure control-flow change,
// none of the math/thresholds below moved or changed. Stage 1 (resize/
// decode/tensor-build) never touches the model, so any failure there is
// 'decode_failed'. Stage 2 (runSync + SSD decode) is the model/native-module
// call, so a failure there is 'model_unavailable'; a clean run that simply
// finds no anchor above SCORE_THRESHOLD is 'no_face' (not a failure at all).
type PassResult =
  | { ok: true; landmarks: FaceLandmarks }
  | { ok: false; failure: DetectFailureKind; error?: unknown };

async function detectFacePass(
  model: TensorflowModel,
  photoUri: string,
  regionW: number,
  regionH: number,
  cropPx?: { originX: number; originY: number; width: number; height: number },
): Promise<PassResult> {
  let img: { width: number; height: number; data: Uint8Array };
  let offX: number, offY: number;
  let input: Uint8Array | Float32Array;
  try {
    // 1. Scale uniformly so the LONG side is MODEL_SIZE; letterbox-pad the rest.
    const scale = MODEL_SIZE / Math.max(regionW, regionH);
    const tW = Math.max(1, Math.min(MODEL_SIZE, Math.round(regionW * scale)));
    const tH = Math.max(1, Math.min(MODEL_SIZE, Math.round(regionH * scale)));

    const actions = cropPx
      ? [{ crop: cropPx }, { resize: { width: tW, height: tH } }]
      : [{ resize: { width: tW, height: tH } }];
    const resized = await manipulateAsync(
      photoUri,
      actions,
      { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
    );
    if (!resized.base64) return { ok: false, failure: 'decode_failed' };

    img = decodeJpegBase64(resized.base64);
    const pixelCount = MODEL_SIZE * MODEL_SIZE;

    offX = (MODEL_SIZE - img.width) >> 1;
    offY = (MODEL_SIZE - img.height) >> 1;

    // 2. Build the [1,128,128,3] input tensor (float32 vs uint8, same branch
    //    pattern as poseEstimate/silhouette).
    const inputDataType = model.inputs[0]?.dataType ?? 'float32';
    const isFloat = inputDataType === 'float32';
    input = isFloat
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
  } catch (err) {
    // Model file missing is handled by the caller (loadFaceModel, before
    // this pass ever runs) — anything thrown here is the image itself
    // (manipulator/jpeg-js/native decode error), not the model.
    return { ok: false, failure: 'decode_failed', error: err };
  }

  try {
    // 3. Run inference. BlazeFace short-range outputs two tensors:
    //    regressors [1,896,16] and classificators [1,896,1]. Order in
    //    `model.runSync` output follows the model's own output order — try
    //    both slots defensively by checking each tensor's flat length.
    const outputs = model.runSync([input]);
    if (!outputs || outputs.length < 2) return { ok: false, failure: 'model_unavailable' };

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
    if (!regressors || !classificators) return { ok: false, failure: 'model_unavailable' };

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
    if (bestIdx < 0 || bestScore < SCORE_THRESHOLD) return { ok: false, failure: 'no_face' };

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

    // Box regression at reg indices 0..3: center offset (px) then width/height
    // (px), same 128-px-unit convention as the keypoint offsets above.
    const boxDx = (regressors as ArrayLike<number>)[regBase + 0] as number;
    const boxDy = (regressors as ArrayLike<number>)[regBase + 1] as number;
    const boxW = (regressors as ArrayLike<number>)[regBase + 2] as number;
    const boxH = (regressors as ArrayLike<number>)[regBase + 3] as number;
    const boxCx = anchor.cx + boxDx / MODEL_SIZE;
    const boxCy = anchor.cy + boxDy / MODEL_SIZE;
    const boxWNorm = boxW / MODEL_SIZE;
    const boxHNorm = boxH / MODEL_SIZE;
    const boxTopLeft = toDisplay({ x: boxCx - boxWNorm / 2, y: boxCy - boxHNorm / 2 });
    const boxBottomRight = toDisplay({ x: boxCx + boxWNorm / 2, y: boxCy + boxHNorm / 2 });
    const box: FaceBox = {
      x: boxTopLeft.x,
      y: boxTopLeft.y,
      width: Math.max(0, boxBottomRight.x - boxTopLeft.x),
      height: Math.max(0, boxBottomRight.y - boxTopLeft.y),
    };

    return {
      ok: true,
      landmarks: {
        rightEye: toDisplay(kp(0)),
        leftEye: toDisplay(kp(1)),
        nose: toDisplay(kp(2)),
        mouth: toDisplay(kp(3)),
        rightEar: toDisplay(kp(4)),
        leftEar: toDisplay(kp(5)),
        box,
        score: bestScore,
      },
    };
  } catch (err) {
    // model.runSync (or the anchor decode immediately around it) threw —
    // this IS the model/native-module invocation failing.
    return { ok: false, failure: 'model_unavailable', error: err };
  }
}

// ── Public: detect the best-scoring face in a photo (2-pass) ─────────────────

/**
 * Detect a single face in `photoUri` and return 4 landmarks (both eyes, nose,
 * mouth) in SOURCE-IMAGE normalised coords (0..1, letterbox undone — same
 * convention as poseEstimate's `display` coords), plus which of
 * `DetectFailureKind` applied on failure — see the module comment at the top
 * of this file for why that distinction exists. Never throws.
 *
 * Runs a first pass on the full image; if that pass misses or the detected
 * face is "weak" (small inter-eye distance — typical of a full-length
 * head-to-toe photo where BlazeFace's 128×128 input leaves only ~8-10px for
 * the face), a second pass re-runs detection on a crop of the upper portion
 * of the frame and prefers a confident hit there. See faceDetectMath.ts. This
 * 2-pass rescue logic is unchanged from before the diagnostics split below.
 */
export async function detectFaceDetailed(
  photoUri: string,
  origW?: number,
  origH?: number,
): Promise<DetectOutcome> {
  let model: TensorflowModel;
  try {
    model = await loadFaceModel();
  } catch (err) {
    return { ok: false, failure: 'model_unavailable', error: err };
  }

  // 0. Resolve source dimensions (probe with a no-op manipulate if needed).
  let sW = origW, sH = origH;
  try {
    if (!sW || !sH || !isFinite(sW) || !isFinite(sH)) {
      const probe = await manipulateAsync(photoUri, []);
      sW = probe.width;
      sH = probe.height;
    }
  } catch (err) {
    return { ok: false, failure: 'decode_failed', error: err };
  }

  try {
    const firstPass = await detectFacePass(model, photoUri, sW, sH);
    const first = firstPass.ok ? firstPass.landmarks : null;

    if (!isWeakDetection(first, sW, sH) && first) {
      return { ok: true, landmarks: first };
    }

    // Second pass: crop to the upper portion of the frame where a
    // full-length shot's face lives, and re-run detection there.
    const cropH = Math.max(1, Math.round(sH * FACE_CROP_REGION.heightNorm));
    const cropPx = { originX: 0, originY: 0, width: Math.round(sW), height: cropH };
    const secondPass = await detectFacePass(model, photoUri, sW, cropH, cropPx);
    const second = secondPass.ok ? mapLandmarksCropToFull(secondPass.landmarks, FACE_CROP_REGION) : null;

    const selected = selectFaceDetection(first, second, sW, sH);
    if (selected) return { ok: true, landmarks: selected };

    // Both passes missed a usable face — report the most actionable failure
    // kind (infra failure beats decode failure beats genuine "no face"), see
    // combineFailureKinds in faceDetectMath.ts.
    const firstFailure = firstPass.ok ? null : firstPass.failure;
    const secondFailure = secondPass.ok ? null : secondPass.failure;
    const error = (!firstPass.ok && firstPass.error !== undefined) ? firstPass.error
      : (!secondPass.ok ? secondPass.error : undefined);
    return { ok: false, failure: combineFailureKinds(firstFailure, secondFailure), error };
  } catch (err) {
    // Belt-and-braces: detectFacePass/isWeakDetection/selectFaceDetection
    // already report their own failures via tagged returns rather than
    // throwing, so this should not normally trigger. If something
    // unexpected does slip through, treat it as the loudest signal
    // (model/infra) rather than silently mislabeling it as "no face found".
    return { ok: false, failure: 'model_unavailable', error: err };
  }
}

/**
 * Back-compat wrapper around `detectFaceDetailed` for callers that only ever
 * cared about success/null (e.g. analyzeFace in personal-color) — collapses
 * every failure kind back to `null`, same contract as before this file's
 * 2026-08-14 diagnostics split.
 */
export async function detectFace(
  photoUri: string,
  origW?: number,
  origH?: number,
): Promise<FaceLandmarks | null> {
  const outcome = await detectFaceDetailed(photoUri, origW, origH);
  return outcome.ok ? outcome.landmarks : null;
}
