// Pure geometry helpers for the 2-pass face detector (try-on fixes,
// 2026-08-06) — no native/Expo imports, so jest can test them directly.
// Mirrors the split used by faceComposite.ts / faceCompositeMath.ts: this
// module owns the crop-mapping + pass-selection math, faceDetect.ts owns the
// native decode/inference around it.

export type Pt = { x: number; y: number };

export interface FaceBox { x: number; y: number; width: number; height: number }

export interface FaceLandmarks {
  rightEye: Pt;
  leftEye: Pt;
  nose: Pt;
  mouth: Pt;
  /** Ear keypoints — added for the personal-colour face scan (feature
   *  010-wardrobe-critic phase A), unused by try-on's own compositing. */
  rightEar: Pt;
  leftEar: Pt;
  /** Detection bounding box, normalised [0,1] source-image coords,
   *  top-left origin — added for the personal-colour face scan (hair-band
   *  region needs the box's top edge). CALIBRATION-PENDING alongside
   *  NORMALIZE_TO_UNIT in faceDetect.ts: the SSD box-regression channel
   *  order (center offset then width/height, mirroring the keypoint layout)
   *  is the standard MediaPipe convention but untested on-device. */
  box: FaceBox;
  /** Detection confidence 0..1 (post-sigmoid). */
  score: number;
}

/** A sub-region of the source image, in image-normalised [0,1] coords. */
export interface CropRegion {
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
}

// CALIBRATION-PENDING: minimum inter-eye distance, as a fraction of the
// source image's larger dimension, below which a detection is treated as
// "weak" — the face is small enough (typically a full-length head-to-toe
// photo) that a composite built on it would be unreliable, so a second pass
// on a face-focused crop is attempted instead. Needs on-device tuning
// against a range of real full-length photos.
export const WEAK_INTER_EYE_FRACTION = 0.04;

// Second-pass crop region: upper 40% of the image height, full width — where
// a face sits in a head-to-toe full-length shot.
export const FACE_CROP_REGION: CropRegion = { xNorm: 0, yNorm: 0, widthNorm: 1, heightNorm: 0.4 };

/** Inter-eye distance in SOURCE-IMAGE pixel space, given landmarks normalised
 * to the source image's own width/height. */
export function interEyeDistancePx(landmarks: FaceLandmarks, srcW: number, srcH: number): number {
  const dx = (landmarks.rightEye.x - landmarks.leftEye.x) * srcW;
  const dy = (landmarks.rightEye.y - landmarks.leftEye.y) * srcH;
  return Math.hypot(dx, dy);
}

/** True when there's no detection, or its inter-eye distance is below
 * WEAK_INTER_EYE_FRACTION of the larger source dimension. */
export function isWeakDetection(landmarks: FaceLandmarks | null, srcW: number, srcH: number): boolean {
  if (!landmarks) return true;
  if (!isFinite(srcW) || !isFinite(srcH) || srcW <= 0 || srcH <= 0) return true;
  const threshold = WEAK_INTER_EYE_FRACTION * Math.max(srcW, srcH);
  return interEyeDistancePx(landmarks, srcW, srcH) < threshold;
}

/** Map a single point from crop-local normalised coords [0,1] into
 * full-image normalised coords, given the crop's placement in the full image. */
export function mapPointCropToFull(p: Pt, crop: CropRegion): Pt {
  return {
    x: crop.xNorm + p.x * crop.widthNorm,
    y: crop.yNorm + p.y * crop.heightNorm,
  };
}

/** Map a full FaceLandmarks detection — produced by running the detector on
 * a CROPPED sub-image, so its coords are normalised to that crop's own
 * frame — back into full-image normalised coords. */
export function mapLandmarksCropToFull(landmarks: FaceLandmarks, crop: CropRegion): FaceLandmarks {
  const mapPt = (p: Pt) => mapPointCropToFull(p, crop);
  return {
    rightEye: mapPt(landmarks.rightEye),
    leftEye: mapPt(landmarks.leftEye),
    nose: mapPt(landmarks.nose),
    mouth: mapPt(landmarks.mouth),
    rightEar: mapPt(landmarks.rightEar),
    leftEar: mapPt(landmarks.leftEar),
    box: {
      x: crop.xNorm + landmarks.box.x * crop.widthNorm,
      y: crop.yNorm + landmarks.box.y * crop.heightNorm,
      width: landmarks.box.width * crop.widthNorm,
      height: landmarks.box.height * crop.heightNorm,
    },
    score: landmarks.score,
  };
}

/**
 * Choose between a first-pass (full-image) and second-pass (face-crop,
 * already mapped back to full-image coords) detection.
 *
 * - A confident first-pass hit always wins (no need for the crop pass).
 * - Otherwise, a confident second-pass hit is preferred (the crop pass exists
 *   specifically to rescue a weak/missing first-pass hit).
 * - If neither is confident, keep whichever has the higher score; if only
 *   one exists, keep that one.
 * - null only when both passes missed entirely.
 */
export function selectFaceDetection(
  first: FaceLandmarks | null,
  second: FaceLandmarks | null,
  srcW: number,
  srcH: number,
): FaceLandmarks | null {
  if (!isWeakDetection(first, srcW, srcH)) return first;
  if (second && !isWeakDetection(second, srcW, srcH)) return second;
  if (first && second) return first.score >= second.score ? first : second;
  return first ?? second ?? null;
}
