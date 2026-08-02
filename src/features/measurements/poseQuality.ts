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
  | 'straighten'     // shoulders/hips not level, or turned away from front-on
  | 'tilt_phone'     // PHONE (not the person) is tilted off-upright — driven by
                     // app/measurements-scan.tsx's DeviceMotion gate, never
                     // returned by `assessPose` itself (it has no sensor input)
  | 'turn_side';     // SIDE-CAPTURE only (`assessSidePose` below): the person is
                     // still facing too front-on — shoulder/hip x-span isn't
                     // foreshortened enough to be a genuine profile shot

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

  // Turned-sideways check: a person angled away from front-on presents a
  // foreshortened shoulder x-span even though both shoulders are perfectly
  // level (so the tilt check above wouldn't catch it). `frameFill` already
  // is the person's unit height (nose→ankle span / 0.88) — compare the
  // shoulder span against a fraction of THAT, not the frame, so the
  // threshold scales with how close/far the person stands.
  const shoulderSpan = Math.abs(by['leftShoulder'].x - by['rightShoulder'].x);
  const turnedSideways = shoulderSpan < 0.15 * frameFill;

  if (shoulderTilt > Q.levelTol || hipTilt > Q.levelTol || turnedSideways) {
    return { ok: false, hint: 'straighten', frameFill, present, missing };
  }

  return { ok: true, hint: 'ok', frameFill, present, missing };
}

// ── SIDE (profile) pose quality — the "turn 90°" capture pass ───────────────
//
// Unlike the front-view gate above, a profile view only ever shows ONE side
// of the body clearly — the far shoulder/hip/ankle being invisible or
// low-confidence is expected, not a defect (occlusion by the torso IS the
// evidence the person is actually turned sideways). So `assessSidePose`
// requires just one confident joint per pair, not both, and adds its own
// "are they actually turned sideways" check that `assessPose`'s `straighten`
// hint doesn't cover (that hint fires for a front-view pose that's ACCIDENTALLY
// foreshortened; here foreshortening is the GOAL, and its ABSENCE is the defect).

/** Landmark PAIRS required for a usable side frame — at least one joint of
 *  each pair must be confident (see the module doc comment above). */
const SIDE_REQUIRED_PAIRS: [string, string][] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftHip', 'rightHip'],
  ['leftAnkle', 'rightAnkle'],
];

/** Max shoulder/hip x-span (as a fraction of the person's own unit height)
 *  before a pose reads as still facing too front-on. CALIBRATION-PENDING —
 *  tune on a device; 0.10 is a first-cut guess, tighter than `assessPose`'s
 *  0.15 `turnedSideways` threshold since a genuine profile shot should read
 *  much narrower than a merely-foreshortened front-on one. */
const SIDE_PROFILE_SPAN_MAX = 0.10;

/**
 * Assess whether `kps` (from the LIVE poll loop, same square-space keypoints
 * `assessPose` takes) represent a usable SIDE (profile) capture frame.
 *
 * Required: a confident `nose`, plus at least one confident joint from EACH
 * of the shoulder/hip/ankle pairs (`SIDE_REQUIRED_PAIRS`) — a pair with only
 * one joint confident passes; both being absent/low-confidence fails it.
 *
 * `frameFill`: nose→(lowest confident ankle) span / 0.88, same convention and
 * `fillMin`/`fillMax` bounds as `assessPose`.
 *
 * Profile check: for whichever of the shoulder/hip pairs has BOTH joints
 * confident, its x-span must be < `SIDE_PROFILE_SPAN_MAX` × the person's unit
 * height — a person actually turned sideways presents a foreshortened x-span
 * for any pair still fully visible. A pair with only one confident joint
 * passes this check automatically (the far joint's occlusion by the torso IS
 * the profile evidence — there's no span to measure). Failing this returns
 * the new `'turn_side'` hint.
 */
export function assessSidePose(kps: Keypoint[]): PoseQuality {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;

  const noseOk = !!by['nose'] && by['nose'].score >= Q.minScore;
  const pairOk = ([a, b]: [string, string]) =>
    (!!by[a] && by[a].score >= Q.minScore) || (!!by[b] && by[b].score >= Q.minScore);

  const missing: string[] = [];
  if (!noseOk) missing.push('nose');
  for (const pair of SIDE_REQUIRED_PAIRS) {
    if (!pairOk(pair)) missing.push(pair.join('|'));
  }
  const present = (noseOk ? 1 : 0) + SIDE_REQUIRED_PAIRS.filter(pairOk).length;

  if (missing.length > 0) {
    const onlyAnklesMissing = missing.length === 1 && missing[0] === 'leftAnkle|rightAnkle';
    const hint: PoseHint = onlyAnklesMissing ? 'show_feet'
      : present <= 1 ? 'no_person' : 'move_into_frame';
    return { ok: false, hint, frameFill: 0, present, missing };
  }

  const nose = by['nose'];
  const confidentAnkles = ['leftAnkle', 'rightAnkle'].filter((n) => by[n] && by[n].score >= Q.minScore);
  const lowestAnkleY = Math.max(...confidentAnkles.map((n) => by[n].y));
  const frameFill = Math.abs(lowestAnkleY - nose.y) / 0.88;
  if (frameFill < Q.fillMin) return { ok: false, hint: 'step_closer', frameFill, present, missing };
  if (frameFill > Q.fillMax) return { ok: false, hint: 'step_back', frameFill, present, missing };

  const spanOk = ([a, b]: [string, string]) => {
    const ka = by[a], kb = by[b];
    const bothConfident = !!ka && !!kb && ka.score >= Q.minScore && kb.score >= Q.minScore;
    if (!bothConfident) return true; // one joint occluded — itself the profile evidence
    return Math.abs(ka.x - kb.x) < SIDE_PROFILE_SPAN_MAX * frameFill;
  };
  const isProfile = spanOk(['leftShoulder', 'rightShoulder']) && spanOk(['leftHip', 'rightHip']);
  if (!isProfile) return { ok: false, hint: 'turn_side', frameFill, present, missing };

  return { ok: true, hint: 'ok', frameFill, present, missing };
}
