// Pure face-landmark → pixel-region geometry for the personal-colour face
// scan. NO native/Expo imports here (see colorMath.ts header) — importable
// from Jest without a device. `analyzePhoto.ts` feeds this module's output
// (pixel rects) into its own pixel-buffer sampling; this file only does the
// geometry.
//
// All keypoint/box inputs are NORMALISED [0,1] source-image coordinates (the
// convention try-on's `faceDetect.ts` already uses) plus the image's pixel
// dimensions; all outputs are pixel rects clamped to the image bounds.

export interface Pt { x: number; y: number }

/** Normalised [0,1] face bounding box, top-left origin. */
export interface FaceBox { x: number; y: number; width: number; height: number }

/** The 6 BlazeFace keypoints, normalised [0,1] source-image coordinates. */
export interface FaceKeypoints {
  rightEye: Pt;
  leftEye: Pt;
  nose: Pt;
  mouth: Pt;
  rightEar: Pt;
  leftEar: Pt;
}

/** A sample region in PIXEL coordinates (top-left origin), already clamped
 *  to the image bounds. */
export interface PixelRect { x: number; y: number; width: number; height: number }

export interface FaceRegions {
  /** [right-side, left-side] — matches the keypoint naming (camera-subject's
   *  own right/left, not screen-left/right). */
  cheekRegions: [PixelRect, PixelRect];
  foreheadRegion: PixelRect;
  /** [right eye, left eye] — sclera candidates come from inside these. */
  eyeRegions: [PixelRect, PixelRect];
  /** The band of the full image above the face box's top edge, or null if
   *  the box already touches (or nearly touches) the top of the frame. */
  hairBand: PixelRect | null;
}

const CHEEK_WIDTH_FACTOR = 0.22;
const CHEEK_HEIGHT_FACTOR = 0.18;
const CHEEK_PUSH_FACTOR = 0.15;
const FOREHEAD_HEIGHT_FACTOR = 0.35;
const FOREHEAD_OFFSET_FACTOR = 0.45;
const EYE_WIDTH_FACTOR = 0.30;
const EYE_HEIGHT_FACTOR = 0.16;
const HAIR_BAND_MIN_HEIGHT_PX = 8;

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Rect centred on `center`, given full width/height, clamped to the image. */
function centeredRect(center: Pt, width: number, height: number, imgW: number, imgH: number): PixelRect {
  const x = clamp(center.x - width / 2, 0, Math.max(0, imgW - width));
  const y = clamp(center.y - height / 2, 0, Math.max(0, imgH - height));
  const w = clamp(width, 0, imgW - x);
  const h = clamp(height, 0, imgH - y);
  return { x, y, width: w, height: h };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** One cheek region: centred laterally between the eye and mouth keypoints
 *  on that side, then pushed outward (toward the ear) so it lands on the
 *  cheek rather than the nose fold. */
function cheekRegion(eye: Pt, mouth: Pt, ear: Pt, iod: number, imgW: number, imgH: number): PixelRect {
  const mid = midpoint(eye, mouth);
  const toEar = { x: ear.x - mid.x, y: ear.y - mid.y };
  const toEarLen = Math.hypot(toEar.x, toEar.y);
  const push = toEarLen > 0
    ? { x: (toEar.x / toEarLen) * CHEEK_PUSH_FACTOR * iod, y: (toEar.y / toEarLen) * CHEEK_PUSH_FACTOR * iod }
    : { x: 0, y: 0 };
  const center: Pt = { x: mid.x + push.x, y: mid.y + push.y };
  return centeredRect(center, CHEEK_WIDTH_FACTOR * iod, CHEEK_HEIGHT_FACTOR * iod, imgW, imgH);
}

/**
 * Computes pixel sample regions from a BlazeFace detection. `box`/`kp` are
 * normalised [0,1] source-image coordinates; `imgWidth`/`imgHeight` are the
 * PIXEL dimensions of the image these regions will be sampled from (the
 * caller may be sampling a different — but same-aspect — decoded buffer than
 * whatever image the detection ran on; normalised coordinates transfer
 * directly as long as the aspect ratio matches).
 */
export function computeFaceRegions(
  imgWidth: number,
  imgHeight: number,
  box: FaceBox,
  kp: FaceKeypoints,
): FaceRegions {
  const toPx = (p: Pt): Pt => ({ x: p.x * imgWidth, y: p.y * imgHeight });
  const rightEye = toPx(kp.rightEye);
  const leftEye = toPx(kp.leftEye);
  const mouth = toPx(kp.mouth);
  const rightEar = toPx(kp.rightEar);
  const leftEar = toPx(kp.leftEar);

  const iod = Math.max(1e-6, dist(rightEye, leftEye)); // inter-ocular distance, px

  const cheekRegions: [PixelRect, PixelRect] = [
    cheekRegion(rightEye, mouth, rightEar, iod, imgWidth, imgHeight),
    cheekRegion(leftEye, mouth, leftEar, iod, imgWidth, imgHeight),
  ];

  const eyeLineY = (rightEye.y + leftEye.y) / 2;
  const eyeMidX = (rightEye.x + leftEye.x) / 2;
  const foreheadWidth = Math.max(1, Math.abs(rightEye.x - leftEye.x));
  const foreheadHeight = FOREHEAD_HEIGHT_FACTOR * iod;
  const foreheadBottomY = eyeLineY - FOREHEAD_OFFSET_FACTOR * iod;
  const foreheadCenter: Pt = { x: eyeMidX, y: foreheadBottomY - foreheadHeight / 2 };
  const foreheadRegion = centeredRect(foreheadCenter, foreheadWidth, foreheadHeight, imgWidth, imgHeight);

  const eyeRegions: [PixelRect, PixelRect] = [
    centeredRect(rightEye, EYE_WIDTH_FACTOR * iod, EYE_HEIGHT_FACTOR * iod, imgWidth, imgHeight),
    centeredRect(leftEye, EYE_WIDTH_FACTOR * iod, EYE_HEIGHT_FACTOR * iod, imgWidth, imgHeight),
  ];

  const boxTopPx = clamp(box.y * imgHeight, 0, imgHeight);
  const hairBand: PixelRect | null = boxTopPx < HAIR_BAND_MIN_HEIGHT_PX
    ? null
    : { x: 0, y: 0, width: imgWidth, height: boxTopPx };

  return { cheekRegions, foreheadRegion, eyeRegions, hairBand };
}
