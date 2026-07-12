// Pure pose-quality assessment for the LIVE measurement scanner.
//
// Given the square-space keypoints from estimateKeypoints (x and y share a unit),
// decide whether the framing is good enough to capture, and if not, which single
// hint to surface. Kept pure (no RN deps) so it is unit-testable without a device.

import type { Keypoint } from './poseEstimate';

/** COCO skeleton bones (by keypoint name) for drawing the overlay. */
export const SKELETON_EDGES: [string, string][] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'], ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
];

/** Landmarks that must be visible for a usable full-body measurement frame. */
export const REQUIRED_KP = [
  'nose', 'leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'leftAnkle', 'rightAnkle',
] as const;

export type PoseHint =
  | 'ok'              // good — hold still
  | 'no_person'      // nobody / barely detected
  | 'move_into_frame' // partly out of frame
  | 'show_feet'      // upper body fine but ankles missing — the classic selfie crop
  | 'step_back'      // too close / cropped
  | 'step_closer'    // too far
  | 'straighten';    // shoulders/hips not level (tilted or angled)

export interface PoseQuality {
  ok: boolean;
  hint: PoseHint;
  /** Standing height as a fraction of the frame (same model as the cm scale). */
  frameFill: number;
  /** How many of the REQUIRED_KP landmarks cleared minScore (diagnostics). */
  present: number;
  /** Required landmarks that did NOT clear minScore (diagnostics). */
  missing: string[];
}

// Tunables — CALIBRATION-PENDING (tune on a device).
export const Q = {
  minScore: 0.3,
  fillMin: 0.55,   // below → too far
  fillMax: 0.98,   // above → too close / cropped
  levelTol: 0.06,  // max shoulder/hip vertical tilt (normalised units)
  // Consecutive OK frames before auto-capture. 3 frames ≈ 3.6 s at the 1.2 s
  // poll — long enough to drive the on-screen giant countdown (2…1) that tells
  // a user standing 2-3 m away that hands-free capture is about to fire.
  goodFramesToCapture: 3,
};

export function assessPose(kps: Keypoint[]): PoseQuality {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;

  const missing = REQUIRED_KP.filter((n) => !by[n] || by[n].score < Q.minScore) as string[];
  const present = REQUIRED_KP.length - missing.length;
  if (missing.length > 0) {
    // The classic selfie failure: upper body detects fine (skeleton visibly
    // draws) but the feet are cropped or too low-confidence — call it out
    // specifically instead of a generic "get in frame".
    const onlyAnklesMissing = missing.every((n) => n === 'leftAnkle' || n === 'rightAnkle');
    const hint: PoseHint = onlyAnklesMissing ? 'show_feet'
      : present <= 2 ? 'no_person' : 'move_into_frame';
    return { ok: false, hint, frameFill: 0, present, missing };
  }

  const nose = by['nose'];
  const avgAnkleY = (by['leftAnkle'].y + by['rightAnkle'].y) / 2;
  const frameFill = Math.abs(avgAnkleY - nose.y) / 0.88;
  if (frameFill < Q.fillMin) return { ok: false, hint: 'step_closer', frameFill, present, missing };
  if (frameFill > Q.fillMax) return { ok: false, hint: 'step_back', frameFill, present, missing };

  const shoulderTilt = Math.abs(by['leftShoulder'].y - by['rightShoulder'].y);
  const hipTilt = Math.abs(by['leftHip'].y - by['rightHip'].y);
  if (shoulderTilt > Q.levelTol || hipTilt > Q.levelTol) {
    return { ok: false, hint: 'straighten', frameFill, present, missing };
  }

  return { ok: true, hint: 'ok', frameFill, present, missing };
}
