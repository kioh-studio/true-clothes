// Pure BlazePose Heavy output decoding — no native/Expo imports, so jest can
// test the tensor-decode math directly without a device or the TF Lite
// runtime. Mirrors the existing cropMath.ts / silhouetteMath.ts split in this
// feature: this file owns the pure landmark math, poseEstimate.ts owns the
// JPEG-decode/letterbox/native-inference plumbing and calls into this module.
//
// BlazePose Heavy (assets/models/blazepose-heavy.tflite, MediaPipe, Apache-2.0)
// replaces MoveNet Thunder as the capture-time crop-refinement model — see
// the module doc comment in poseEstimate.ts for the full two-pass pipeline
// context. This file documents the OUTPUT decode specifically:
//
//   - Primary landmark tensor: [1, 195] = 39 landmarks × 5 floats
//     (x, y, z, visibility, presence). x/y are in INPUT PIXELS (0..256, i.e.
//     0..modelSize) — divide by modelSize to land in the model's own
//     normalised square space (the same convention `inferKeypointsInSquare`
//     uses for MoveNet). z (depth, roughly hip-relative) is available but
//     NOT used anywhere downstream yet — FUTURE WORK, once a measurement
//     model exists that can make use of a depth signal; ignoring it today
//     changes nothing (it simply isn't read).
//   - visibility/presence are raw LOGITS, not probabilities — `sigmoid()`
//     squashes visibility to 0..1 for use as `Keypoint.score`. `presence`
//     (landmark exists in the crop at all, vs. visibility = not occluded)
//     is read but not currently surfaced as a second signal —
//     CALIBRATION-PENDING whether that's worth doing later.
//   - `poseflagLogit`: a SEPARATE [1,1] output — BlazePose's own overall
//     "is there a usable pose in this crop at all" gate, independent of any
//     per-landmark score. Sigmoid below 0.5 → the whole decode returns null.
//   - Other outputs the model exposes (segmentation mask, heatmap, world
//     landmarks [1,117]) are ignored entirely by this decode — see the
//     module doc comment in poseEstimate.ts for why (reserved future work).
//
// Landmark index → name mapping is BlazePose's fixed 33-point topology.
// Indices 33-38 are auxiliary/ROI-tracking points BlazePose adds for its own
// frame-to-frame tracking loop — irrelevant to a single still-photo capture,
// and simply absent from the map below (nothing reads them).

import type { Keypoint } from './poseEstimate';

/** 1 / (1 + e^-x) — squash a logit to a 0..1 probability. */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Floats per landmark in BlazePose's [1, 195] tensor: x, y, z, visibility, presence. */
export const BLAZEPOSE_LANDMARK_STRIDE = 5;
/** Total landmarks BlazePose emits (33 body points + 6 auxiliary ones we ignore). */
export const BLAZEPOSE_LANDMARK_COUNT = 39;
/** Expected flat length of the primary landmark output tensor (39 × 5 = 195). */
export const BLAZEPOSE_LANDMARKS_LENGTH = BLAZEPOSE_LANDMARK_COUNT * BLAZEPOSE_LANDMARK_STRIDE;

/**
 * BlazePose landmark index (0-32; 33-38 are the auxiliary points this app
 * ignores, see the module doc comment) → the keypoint name the rest of this
 * feature reads by name. The first 17 entries are EXACTLY MoveNet's COCO
 * topology, same names — every existing name-based lookup elsewhere in this
 * feature (landmarksToMeasurements.ts, silhouetteMath.ts, poseQuality.ts,
 * aggregateFrames.ts) keeps working completely unmodified. The last 4 are
 * NEW (BlazePose has no MoveNet equivalent) and exist specifically for the
 * floor-line height/inseam estimate added to landmarksToMeasurements.ts
 * alongside this migration.
 */
export const BLAZEPOSE_LANDMARK_MAP: { idx: number; name: string }[] = [
  { idx: 0,  name: 'nose' },
  { idx: 2,  name: 'leftEye' },
  { idx: 5,  name: 'rightEye' },
  { idx: 7,  name: 'leftEar' },
  { idx: 8,  name: 'rightEar' },
  { idx: 11, name: 'leftShoulder' },
  { idx: 12, name: 'rightShoulder' },
  { idx: 13, name: 'leftElbow' },
  { idx: 14, name: 'rightElbow' },
  { idx: 15, name: 'leftWrist' },
  { idx: 16, name: 'rightWrist' },
  { idx: 23, name: 'leftHip' },
  { idx: 24, name: 'rightHip' },
  { idx: 25, name: 'leftKnee' },
  { idx: 26, name: 'rightKnee' },
  { idx: 27, name: 'leftAnkle' },
  { idx: 28, name: 'rightAnkle' },
  { idx: 29, name: 'leftHeel' },        // NEW — no MoveNet equivalent.
  { idx: 30, name: 'rightHeel' },       // NEW
  { idx: 31, name: 'leftFootIndex' },   // NEW — toe tip.
  { idx: 32, name: 'rightFootIndex' },  // NEW
];

/**
 * Find the output tensor holding exactly `length` elements. BlazePose Heavy
 * exposes several output tensors (landmarks, poseflag, segmentation,
 * heatmap, world landmarks) and `TensorflowModel.runSync` returns them
 * POSITIONALLY matching `model.outputs` metadata — not something this code
 * wants to hardcode an index against, since model exports can reorder
 * outputs between conversions. The expected lengths (195 for landmarks, 1
 * for poseflag) are distinct enough that a length-based lookup is
 * unambiguous. Returns -1 when nothing matches (an unexpected model
 * variant) — the caller treats that as a decode failure, not a crash.
 *
 * Typed `{ length: number }[]` rather than `ArrayLike<number>[]` — the real
 * caller passes `TensorflowModel.runSync`'s output array, whose element type
 * (react-native-fast-tflite's internal `TypedArray` union) includes
 * `BigInt64Array`/`BigUint64Array`, which are NOT `ArrayLike<number>` (their
 * index signature yields `bigint`). This function only ever reads `.length`,
 * so the minimal shape avoids that mismatch entirely.
 */
export function findOutputIndexByLength(outputs: { length: number }[], length: number): number {
  for (let i = 0; i < outputs.length; i++) {
    if (outputs[i].length === length) return i;
  }
  return -1;
}

/**
 * Decode BlazePose's raw landmark tensor + poseflag logit into our named
 * Keypoint[] (17 shared COCO names + 4 new heel/toe names), in the model's
 * own `modelSize`-normalised square space — pure math, no image/tensor
 * plumbing, directly unit-testable with a synthetic 195-float array.
 *
 * Returns null when `poseflagLogit` sigmoids below 0.5 — BlazePose's own
 * "no usable pose in this crop" signal, independent of any per-landmark
 * score (see the module doc comment above).
 */
export function decodeBlazePoseLandmarks(
  landmarks: ArrayLike<number>,
  poseflagLogit: number,
  modelSize: number,
): Keypoint[] | null {
  if (sigmoid(poseflagLogit) < 0.5) return null;

  return BLAZEPOSE_LANDMARK_MAP.map(({ idx, name }) => {
    const base = idx * BLAZEPOSE_LANDMARK_STRIDE;
    const px = landmarks[base]     as number; // INPUT PIXELS 0..modelSize, NOT 0..1
    const py = landmarks[base + 1] as number;
    // landmarks[base + 2] is z — read nowhere, see the module doc comment.
    const visibilityLogit = landmarks[base + 3] as number;
    return {
      name,
      x: px / modelSize,
      y: py / modelSize,
      score: sigmoid(visibilityLogit),
    };
  });
}
