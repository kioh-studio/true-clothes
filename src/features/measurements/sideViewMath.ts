// Pure side-view (profile) depth extraction — no native/Expo imports so jest
// can test it directly, mirroring the existing silhouetteMath.ts/cropMath.ts
// split in this feature: this file owns the pure side-view math, the scan
// screen (app/measurements-scan.tsx) owns the JPEG/crop/native-inference
// plumbing and calls into this module.
//
// WHY THIS EXISTS: keypointsToMeasurements has always GUESSED front-to-back
// body depth from a BMI-driven ratio applied to the front-view width
// (chestDepthRatio/waistDepthRatio/hipDepthRatio in landmarksToMeasurements.ts's
// K) — there has never been a photo that could actually show depth. A second,
// profile (sideways) capture lets depth be MEASURED instead of guessed —
// published ablations (see plan.md/backlog.md) report this as the single
// biggest accuracy lever left for bust/waist/hip circumference.
//
// CROSS-VIEW REGISTRATION: the front view already located the anatomical
// chest/waist/hip ROWS on its own mask (silhouetteMath.ts's `extractWidths`,
// which now also records `chestRowFrac`/`waistRowFrac`/`hipRowFrac` — each
// row's position as a FRACTION of the shoulder→hip vertical span, 0 =
// shoulder line, 1 = hip line). A fraction of that span is view-invariant —
// the same fraction should land on the same anatomical row whether it's
// measured on the front photo or the side photo, even though the two photos
// were taken at different distances/crops and have different absolute pixel
// scales. This module re-locates those SAME rows on the SIDE mask by
// fraction, then runs the SAME kind of band-extreme scan the front view
// uses — except in a profile photo, that scan measures DEPTH (front-to-back),
// not the front view's left-right WIDTH.

import type { Keypoint } from './poseEstimate';
import { bandExtremeWidthRow, S, type SilhouetteMask } from './silhouetteMath';

const MIN_KP_SCORE = 0.3;

/** Row-fraction inputs — the SAME shape/convention as the front view's
 *  `SilhouetteWidths.chestRowFrac`/`waistRowFrac`/`hipRowFrac` (a
 *  `SilhouetteWidths` value can be passed here directly; only these three
 *  fields are read). Fields absent → this module falls back to a fixed
 *  anatomical default for that row (see `extractSideDepths`'s doc comment). */
export interface SideRowFracs {
  chestRowFrac?: number;
  waistRowFrac?: number;
  hipRowFrac?: number;
}

/** Front-to-back depth readings, in the mask's OWN normalised units — SAME
 *  convention as `SilhouetteWidths`: crop-square units when given a cropped
 *  mask, full-square when given a full-frame one. The caller converts. */
export interface SideDepths {
  chestU?: number;
  waistU?: number;
  hipU?: number;
}

// Band scanned around each registered row. Narrower than the front view's
// per-region bands (S.chestBand etc.) because the row's vertical POSITION is
// already borrowed from the front scan — this band only needs to absorb
// frame-to-frame jitter in the side capture itself, not re-locate the
// anatomy from scratch the way the front view's wider bands do.
const SIDE_BAND = 0.02;

/**
 * Measure front-to-back depth at the chest/waist/hip rows on a PROFILE
 * (side-view) segmentation mask, registering each row by the FRACTION the
 * front-view scan already found for it (see the module doc comment).
 *
 * `sideKps` are this side frame's own keypoints, in the SAME normalised
 * space as `mask` (crop-square when `mask` came from a cropped segmentation
 * pass — the caller converts afterward, exactly like `extractWidths`).
 *
 * Method, per region (chest/waist/hip):
 *   1. y = sideShoulderY + frac × sideTorso (frac from `rowFracs`, or a
 *      fixed anatomical default when that field is missing this scan —
 *      chest 0.25 (`S.chestAt`), waist the midpoint of the front view's own
 *      waist search band (`S.waistFrom`..`S.waistTo`), hip the midpoint of
 *      the front view's own hip/seat band, estimated using THIS side
 *      frame's own torso/leg proportions the same way `extractWidths` does).
 *   2. Scan a `SIDE_BAND`-wide band around that row with `bandExtremeWidthRow`
 *      — 'max' for chest and hip (the widest front-to-back row — sternum/
 *      belly, seat), 'min' for waist (the narrowest — the natural waist) —
 *      the SAME mode semantics the front view's width scan uses for each
 *      region, just measuring depth instead of width.
 *
 * `sideShoulderY`/`sideHipY` are the average y of whichever shoulder/hip
 * keypoints are confident (score ≥ 0.3) — in a genuine profile shot at least
 * one side is typically clear even when the far one is fully occluded by the
 * body, so this never requires BOTH like the front view's `extractWidths`
 * does. `centerX` (the column probed for the depth run) is the average x of
 * every confident shoulder+hip keypoint.
 *
 * Returns `{}` (every field absent) when the pose lacks a confident shoulder
 * AND hip pair to anchor the torso span at all — without that there is no
 * row to register against. A region whose OWN band scan finds nothing (mask
 * gap, degenerate crop) is simply omitted from the result, same "leave it
 * blank, don't guess" contract as `extractWidths`.
 */
export function extractSideDepths(
  mask: SilhouetteMask,
  sideKps: Keypoint[],
  rowFracs: SideRowFracs,
): SideDepths {
  const by: Record<string, Keypoint> = {};
  for (const k of sideKps) by[k.name] = k;
  const confident = (name: string) => !!by[name] && by[name].score >= MIN_KP_SCORE;

  const shoulders = ['leftShoulder', 'rightShoulder'].filter(confident);
  const hips = ['leftHip', 'rightHip'].filter(confident);
  if (shoulders.length === 0 || hips.length === 0) return {};

  const shoulderY = shoulders.reduce((s, n) => s + by[n].y, 0) / shoulders.length;
  const hipY = hips.reduce((s, n) => s + by[n].y, 0) / hips.length;
  const torso = hipY - shoulderY;
  if (torso <= 0) return {};

  const centerXNames = [...shoulders, ...hips];
  const centerX = centerXNames.reduce((s, n) => s + by[n].x, 0) / centerXNames.length;

  const ankles = ['leftAnkle', 'rightAnkle'].filter(confident);
  const legLen = ankles.length
    ? (ankles.reduce((s, n) => s + by[n].y, 0) / ankles.length) - hipY
    : torso; // no ankles → approximate leg proportions from the torso span, same fallback as extractWidths

  // Fixed anatomical-default row fractions — used only when the front scan
  // never resolved that particular row this session. Chest/waist mirror
  // extractWidths' fixed constants directly; hip is computed from THIS
  // side frame's own torso/legLen (extractWidths' hip band isn't a fixed
  // fraction of torso — it's anchored to hipY with its own up/down margins),
  // converted to a shoulder-relative fraction for the shared `rowY` below.
  const defaultChestFrac = S.chestAt;
  const defaultWaistFrac = (S.waistFrom + S.waistTo) / 2;
  const hipBandTopFrac = 1 - S.hipUpTorsoFraction;
  const hipBandBotFrac = 1 + (S.hipDownLegFraction * legLen) / torso;
  const defaultHipFrac = (hipBandTopFrac + hipBandBotFrac) / 2;

  const rowY = (frac: number) => shoulderY + frac * torso;

  const chestY = rowY(rowFracs.chestRowFrac ?? defaultChestFrac);
  const waistY = rowY(rowFracs.waistRowFrac ?? defaultWaistFrac);
  const hipY_ = rowY(rowFracs.hipRowFrac ?? defaultHipFrac);

  const chestExtreme = bandExtremeWidthRow(mask, chestY - SIDE_BAND, chestY + SIDE_BAND, centerX, 'max');
  const waistExtreme = bandExtremeWidthRow(mask, waistY - SIDE_BAND, waistY + SIDE_BAND, centerX, 'min');
  const hipExtreme = bandExtremeWidthRow(mask, hipY_ - SIDE_BAND, hipY_ + SIDE_BAND, centerX, 'max');

  return {
    chestU: chestExtreme?.width,
    waistU: waistExtreme?.width,
    hipU:   hipExtreme?.width,
  };
}
