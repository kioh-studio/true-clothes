// On-device colour analysis for the personal-colour camera path.
// Reads the dominant tone from the wrist / hair / face photos and maps it to
// the quiz's controlled options (so the camera ACTUALLY contributes, not
// just decorates).
//
// Pipeline (all on-device, no remote AI): expo-image-manipulator downscales a
// photo → jpeg-js decodes it to RGBA → per-pixel LAB samples are collected
// from the relevant region(s), then:
//   - wrist → filter to a generous skin-colour gamut and classify undertone by
//     LAB hue angle on the average of the surviving pixels; if too few pixels
//     look like skin (bad framing/lighting), fall back to nearest-swatch
//     matching on the plain (unfiltered) average instead. When a second
//     (torch-off / ambient) shot is supplied, a true per-pixel flash/ambient
//     subtraction (PLOS ONE method — see docs/personal-color-v3-research.md)
//     is the PRIMARY classification signal; the older "classify both shots
//     independently and compare" method runs alongside as a confidence
//     cross-check, not the primary read anymore;
//   - hair → cluster on the darkest 40% of sampled pixels (the UI has the user
//     hold hair against a light background, so the hair itself is the dark
//     cluster) and match the nearest controlled swatch, with a margin-based
//     confidence score;
//   - face (`analyzeFace`) → BlazeFace landmarks (reused from try-on's
//     detector) locate cheek/forehead/eye/hair-band regions
//     (`faceRegions.ts`); a screen-flash/no-flash pair is subtracted
//     per-pixel the same way as the wrist when the signal is strong enough
//     (SNR-gated — outdoor daylight where the screen flash barely registers
//     falls back to the flash frame as-is, not a failure); the eye regions'
//     brightest, lowest-chroma pixels stand in for the sclera and derive a
//     white-balance correction (`scleraGains`) applied to every subsequent
//     sample; skin comes from cheeks+forehead (ITA°/hue/chroma), hair from
//     the band above the face box.
//
// Every step is wrapped so a failure returns null → the quiz simply stays
// manual.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { SKIN_OPTIONS, HAIR_OPTIONS, type SkinOption } from './colorSeasonData';
import {
  rgbToLab, hexToRgb, isSkinPixelLab, classifyUndertone, averageLab,
  darkestFraction, nearestSwatch, labHueAngleDeg,
  subtractAmbient, srgbToLinear, itaDeg, chromaC, scleraGains, applyGains,
  type LAB, type RGB,
} from './colorMath';
import { computeFaceRegions, type PixelRect, type FaceKeypoints } from './faceRegions';
import { detectFace } from '../try-on/faceDetect';

// ── base64 JPEG → RGBA ───────────────────────────────────────────────────────

interface DecodedImage { width: number; height: number; data: Uint8Array }

function decodeJpeg(base64: string): DecodedImage {
  const bin = atob(base64); // Hermes provides atob on Expo 54
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // useTArray → return a Uint8Array (RN has no Node Buffer)
  return jpeg.decode(bytes, { useTArray: true }) as DecodedImage;
}

/** Downscale to a fixed 48×48 tile (NOT aspect-preserving — matches the
 *  original wrist/hair sampling, which only ever looked at the central 50%
 *  anyway) and decode. */
async function decodeSmall(uri: string): Promise<DecodedImage | null> {
  try {
    const res = await manipulateAsync(uri, [{ resize: { width: 48, height: 48 } }], {
      base64: true, compress: 0.9, format: SaveFormat.JPEG,
    });
    if (!res.base64) return null;
    return decodeJpeg(res.base64);
  } catch {
    return null; // any decode/manipulate failure → caller falls back to manual
  }
}

/** Downscale to a given WIDTH, keeping aspect ratio, and decode. Used by the
 *  face pipeline, which needs the real frame shape (BlazeFace keypoints are
 *  normalised against the source aspect ratio). */
async function decodeKeepAspect(uri: string, targetWidth: number): Promise<DecodedImage | null> {
  try {
    const res = await manipulateAsync(uri, [{ resize: { width: targetWidth } }], {
      base64: true, compress: 0.9, format: SaveFormat.JPEG,
    });
    if (!res.base64) return null;
    return decodeJpeg(res.base64);
  } catch {
    return null;
  }
}

// Collect per-pixel LAB samples from the central 50% region, skipping
// near-black (shadow/background) and blown-out flash glare pixels so they
// don't pollute the sample. Glare rejection uses the BRIGHTEST channel (mx)
// so that specular highlights — which rarely go pure-white on every channel
// but will spike the peak — are reliably trimmed.
function collectCentralLabs(img: DecodedImage): LAB[] {
  const { width: W, height: H, data } = img;
  const x0 = Math.floor(W * 0.25), x1 = Math.ceil(W * 0.75);
  const y0 = Math.floor(H * 0.25), y1 = Math.ceil(H * 0.75);

  const labs: LAB[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4;
      const R = data[o], G = data[o + 1], B = data[o + 2];
      const mx = Math.max(R, G, B);
      if (mx < 25 || mx > 245) continue; // dark shadow floor | flash glare ceiling
      labs.push(rgbToLab({ r: R, g: G, b: B }));
    }
  }
  return labs;
}

async function sampleCentralLabs(uri: string): Promise<LAB[] | null> {
  const img = await decodeSmall(uri);
  if (!img) return null;
  return collectCentralLabs(img);
}

/** Central-region flash/ambient subtraction: decodes both frames at the same
 *  fixed size, per-pixel `subtractAmbient` (linearised) in the central 50%
 *  region, then the same glare/shadow (mx 25/245) rule as `collectCentralLabs`
 *  applied to the SUBTRACTED pixel (the isolated reflectance signal, not the
 *  raw flash pixel). Null if either frame fails to decode or the two frames
 *  don't match in size (capture glitch — caller falls back to flash-only). */
async function sampleCentralDiffLabs(flashUri: string, ambientUri: string): Promise<LAB[] | null> {
  try {
    const [flashImg, ambientImg] = await Promise.all([decodeSmall(flashUri), decodeSmall(ambientUri)]);
    if (!flashImg || !ambientImg) return null;
    if (flashImg.width !== ambientImg.width || flashImg.height !== ambientImg.height) return null;

    const { width: W, height: H } = flashImg;
    const x0 = Math.floor(W * 0.25), x1 = Math.ceil(W * 0.75);
    const y0 = Math.floor(H * 0.25), y1 = Math.ceil(H * 0.75);

    const labs: LAB[] = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * W + x) * 4;
        const flashRgb: RGB = { r: flashImg.data[o], g: flashImg.data[o + 1], b: flashImg.data[o + 2] };
        const ambientRgb: RGB = { r: ambientImg.data[o], g: ambientImg.data[o + 1], b: ambientImg.data[o + 2] };
        const diff = subtractAmbient(flashRgb, ambientRgb);
        const mx = Math.max(diff.r, diff.g, diff.b);
        if (mx < 25 || mx > 245) continue;
        labs.push(rgbToLab(diff));
      }
    }
    return labs;
  } catch {
    return null;
  }
}

// Pre-compute swatch LABs once.
const SKIN_LAB = SKIN_OPTIONS.map((o) => ({ key: o.key, lab: rgbToLab(hexToRgb(o.swatchHex)) }));
const HAIR_LAB = HAIR_OPTIONS.map((o) => ({ key: o.key, lab: rgbToLab(hexToRgb(o.swatchHex)) }));

const MIN_SKIN_PIXELS = 30;
const MIN_CONFIDENT_SKIN_PIXELS = 60;
const MIN_HUE_MARGIN_DEG = 3; // distance the average hue must clear both thresholds to be "confident"
const MIN_HAIR_PIXELS = 20;
const HAIR_DARK_FRACTION = 0.4;
const HAIR_CONFIDENT_MARGIN = 0.15;

// ── Public: map a wrist/hair photo to a quiz option ──────────────────────────

type WristRead = { key: SkinOption['key']; confident: boolean; skinLab: LAB; hueDeg: number };

/** Core classification shared by every wrist-photo variant (subtracted,
 *  flash-only, ambient-only): filter to the skin gamut and classify by hue
 *  angle when there's enough signal; otherwise fall back to nearest-swatch
 *  matching on the plain average (phone auto-white-balance shifts brightness
 *  far more than hue, so this fallback is always reported low-confidence). */
function classifyFromLabs(labs: LAB[]): WristRead | null {
  const skinLabs = labs.filter(isSkinPixelLab);
  if (skinLabs.length >= MIN_SKIN_PIXELS) {
    const avg = averageLab(skinLabs);
    if (!avg) return null;
    const key = classifyUndertone(avg);
    const angle = labHueAngleDeg(avg);
    const confident = Math.abs(angle - 47) >= MIN_HUE_MARGIN_DEG
      && Math.abs(angle - 57) >= MIN_HUE_MARGIN_DEG
      && skinLabs.length >= MIN_CONFIDENT_SKIN_PIXELS;
    return { key, confident, skinLab: avg, hueDeg: angle };
  }

  const avgAll = averageLab(labs);
  if (!avgAll) return null;
  let best: SkinOption['key'] = SKIN_OPTIONS[0].key;
  let bestD = Infinity;
  for (const s of SKIN_LAB) {
    const da = avgAll.a - s.lab.a, db = avgAll.b - s.lab.b;
    const d = da * da + db * db;
    if (d < bestD) { bestD = d; best = s.key; }
  }
  return { key: best, confident: false, skinLab: avgAll, hueDeg: labHueAngleDeg(avgAll) };
}

/** Wrist photo → skin undertone + a confidence flag + the raw LAB/hue metrics
 *  the classification was based on (used as continuous axes-model inputs).
 *  When `ambientUri` is supplied, a true per-pixel flash/ambient subtraction
 *  (ambient-illuminant cancellation) is the PRIMARY read; the older
 *  classify-both-and-compare method runs as an additional confidence
 *  cross-check on top of it rather than the primary signal. */
export async function analyzeWristUndertone(
  uri: string,
  ambientUri?: string | null,
): Promise<{ key: SkinOption['key']; confident: boolean; skinLab: LAB | null; hueDeg: number | null } | null> {
  try {
    let labs: LAB[] | null = null;
    let usedSubtraction = false;
    if (ambientUri) {
      labs = await sampleCentralDiffLabs(uri, ambientUri);
      usedSubtraction = labs != null;
    }
    if (!labs) labs = await sampleCentralLabs(uri);
    if (!labs) return null;

    const primary = classifyFromLabs(labs);
    if (!primary) return null;

    if (usedSubtraction && ambientUri) {
      const [flashLabs, ambientLabs] = await Promise.all([
        sampleCentralLabs(uri), sampleCentralLabs(ambientUri),
      ]);
      const flashRead = flashLabs ? classifyFromLabs(flashLabs) : null;
      const ambientRead = ambientLabs ? classifyFromLabs(ambientLabs) : null;
      // CALIBRATION-PENDING: corroboration from the older method boosts
      // confidence on top of the subtraction-based primary read, but never
      // demotes an already-confident subtraction read — the subtraction is
      // the more principled signal (see docs/personal-color-v3-research.md).
      const crossCheckAgrees = !!flashRead && !!ambientRead
        && flashRead.key === ambientRead.key && flashRead.key === primary.key;
      return { ...primary, confident: primary.confident || crossCheckAgrees };
    }
    return primary;
  } catch {
    return null;
  }
}

/** Hair photo → nearest HAIR_OPTIONS key + a confidence flag + the darkest-
 *  cluster LAB average the match was based on. */
export async function analyzeHairColor(
  uri: string,
): Promise<{ key: string; confident: boolean; hairLab: LAB | null } | null> {
  const labs = await sampleCentralLabs(uri);
  if (!labs || labs.length === 0) return null;

  const dark = darkestFraction(labs, HAIR_DARK_FRACTION);
  const sample = dark.length >= MIN_HAIR_PIXELS ? dark : labs;
  const avg = averageLab(sample);
  if (!avg) return null;

  const nearest = nearestSwatch(avg, HAIR_LAB);
  if (!nearest) return null;
  return { key: nearest.key, confident: nearest.margin >= HAIR_CONFIDENT_MARGIN, hairLab: avg };
}

// ── Face pipeline ────────────────────────────────────────────────────────────

type Gains = { r: number; g: number; b: number };

const FACE_WORKING_WIDTH = 192;
const FACE_SNR_THRESHOLD = 0.015;
const FACE_MIN_SCLERA_PIXELS = 12;
const SCLERA_TOP_LUMINANCE_FRACTION = 0.15;
const FACE_MIN_SKIN_PIXELS = 25; // "enough to answer at all" — MIN_CONFIDENT_SKIN_PIXELS (60) is the confident bar

function pixelAt(img: DecodedImage, x: number, y: number): RGB {
  const o = (y * img.width + x) * 4;
  return { r: img.data[o], g: img.data[o + 1], b: img.data[o + 2] };
}

function rectBoundsInt(img: { width: number; height: number }, rect: PixelRect) {
  return {
    x0: Math.max(0, Math.floor(rect.x)),
    y0: Math.max(0, Math.floor(rect.y)),
    x1: Math.min(img.width, Math.ceil(rect.x + rect.width)),
    y1: Math.min(img.height, Math.ceil(rect.y + rect.height)),
  };
}

/** Per-pixel `subtractAmbient` across two same-sized decoded frames. */
function buildDiffImage(flash: DecodedImage, ambient: DecodedImage): DecodedImage {
  const { width, height } = flash;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const diff = subtractAmbient(
      { r: flash.data[o], g: flash.data[o + 1], b: flash.data[o + 2] },
      { r: ambient.data[o], g: ambient.data[o + 1], b: ambient.data[o + 2] },
    );
    data[o] = diff.r; data[o + 1] = diff.g; data[o + 2] = diff.b; data[o + 3] = 255;
  }
  return { width, height, data };
}

function meanLinearLuminance(img: DecodedImage, rect: PixelRect): number {
  const { x0, y0, x1, y1 } = rectBoundsInt(img, rect);
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const lin = srgbToLinear(pixelAt(img, x, y));
      sum += (lin.r + lin.g + lin.b) / 3;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

/** Sclera candidates: pixels in the top 15% by linear luminance among those
 *  with C*ab below the eye-region median (bright AND low-chroma — the whites
 *  of the eyes, not iris/lash/skin pixels caught in the same rect). */
function gatherScleraCandidates(img: DecodedImage, eyeRegions: readonly [PixelRect, PixelRect]): RGB[] {
  const all: Array<{ rgb: RGB; chroma: number; lum: number }> = [];
  for (const rect of eyeRegions) {
    const { x0, y0, x1, y1 } = rectBoundsInt(img, rect);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const rgb = pixelAt(img, x, y);
        const lab = rgbToLab(rgb);
        const lin = srgbToLinear(rgb);
        all.push({ rgb, chroma: chromaC(lab), lum: (lin.r + lin.g + lin.b) / 3 });
      }
    }
  }
  if (all.length === 0) return [];

  const sortedChroma = all.map((p) => p.chroma).sort((a, b) => a - b);
  const median = sortedChroma[Math.floor(sortedChroma.length / 2)];
  const belowMedian = all.filter((p) => p.chroma < median).sort((a, b) => b.lum - a.lum);
  const topCount = Math.ceil(belowMedian.length * SCLERA_TOP_LUMINANCE_FRACTION);
  return belowMedian.slice(0, topCount).map((p) => p.rgb);
}

/** Glare/shadow-filtered (mx 25/245, same rule as `collectCentralLabs`) LAB
 *  samples from a region, with an optional sclera white-balance correction
 *  applied before the LAB conversion. */
function collectRegionLabsFiltered(img: DecodedImage, rect: PixelRect, gains: Gains | null): LAB[] {
  const { x0, y0, x1, y1 } = rectBoundsInt(img, rect);
  const labs: LAB[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const rgb = pixelAt(img, x, y);
      const mx = Math.max(rgb.r, rgb.g, rgb.b);
      if (mx < 25 || mx > 245) continue;
      const corrected = gains ? applyGains(rgb, gains) : rgb;
      labs.push(rgbToLab(corrected));
    }
  }
  return labs;
}

export interface FaceAnalysisResult {
  skinLab: LAB | null;
  hairLab: LAB | null;
  hueDeg: number | null;
  ita: number | null;
  chroma: number | null;
  scleraCorrected: boolean;
  snrOk: boolean;
  skinConfident: boolean;
  hairConfident: boolean;
  /** DEVIATION from the A3 instruction's literal return shape (which listed
   *  only skinLab/hairLab/hueDeg/ita/chroma plus the flag fields, no key):
   *  the auto-hair UI chip and the axes model both need a discrete
   *  HAIR_OPTIONS key, not just the raw LAB the nearest-swatch match (A3
   *  step 6) was based on. Smallest deviation that keeps "hair comes from
   *  the selfie's hairBand" (A4) actually functional — recorded in plan.md. */
  hairKey: string | null;
}

/**
 * Full face-selfie analysis: BlazeFace landmarks (try-on's detector, reused
 * as-is) → region geometry (`faceRegions.ts`) → optional screen-flash/ambient
 * subtraction (SNR-gated) → sclera white-balance correction → skin (cheeks +
 * forehead) and hair (band above the face box) sampling. Every step is
 * wrapped — any failure (no face, decode error, native error) returns null,
 * same as every other function in this file; the caller falls back to the
 * manual quiz.
 */
export async function analyzeFace(
  flashUri: string,
  ambientUri: string | null,
): Promise<FaceAnalysisResult | null> {
  try {
    const flashImg = await decodeKeepAspect(flashUri, FACE_WORKING_WIDTH);
    if (!flashImg) return null;

    // BlazeFace runs on the ORIGINAL uri (it does its own internal resize to
    // its 128px model input) — its landmarks are normalised [0,1] against the
    // source image, so they transfer directly onto our same-aspect working
    // copy without any adaptation.
    const landmarks = await detectFace(flashUri);
    if (!landmarks) return null;

    const kp: FaceKeypoints = {
      rightEye: landmarks.rightEye, leftEye: landmarks.leftEye,
      nose: landmarks.nose, mouth: landmarks.mouth,
      rightEar: landmarks.rightEar, leftEar: landmarks.leftEar,
    };
    const regions = computeFaceRegions(flashImg.width, flashImg.height, landmarks.box, kp);

    // ── Ambient subtraction / SNR gate ─────────────────────────────────────
    let workingImg: DecodedImage = flashImg;
    let snrOk = false;
    if (ambientUri) {
      const ambientImg = await decodeKeepAspect(ambientUri, FACE_WORKING_WIDTH);
      if (ambientImg && ambientImg.width === flashImg.width && ambientImg.height === flashImg.height) {
        const diffImg = buildDiffImage(flashImg, ambientImg);
        const faceBoxPx: PixelRect = {
          x: landmarks.box.x * flashImg.width,
          y: landmarks.box.y * flashImg.height,
          width: landmarks.box.width * flashImg.width,
          height: landmarks.box.height * flashImg.height,
        };
        const snr = meanLinearLuminance(diffImg, faceBoxPx);
        snrOk = snr > FACE_SNR_THRESHOLD;
        // !snrOk (e.g. bright outdoor daylight drowning out the screen
        // flash) → discard the subtraction and use the flash frame as-is.
        // Recorded, not a failure.
        if (snrOk) workingImg = diffImg;
      }
    }

    // ── Sclera white-reference correction ──────────────────────────────────
    const scleraCandidates = gatherScleraCandidates(workingImg, regions.eyeRegions);
    const gains = scleraCandidates.length >= FACE_MIN_SCLERA_PIXELS ? scleraGains(scleraCandidates) : null;
    const scleraCorrected = gains != null;

    // ── Skin: cheeks + forehead ──────────────────────────────────────────────
    const skinLabsRaw = [
      ...collectRegionLabsFiltered(workingImg, regions.cheekRegions[0], gains),
      ...collectRegionLabsFiltered(workingImg, regions.cheekRegions[1], gains),
      ...collectRegionLabsFiltered(workingImg, regions.foreheadRegion, gains),
    ];
    const skinLabs = skinLabsRaw.filter(isSkinPixelLab);

    let skinLab: LAB | null = null;
    let hueDeg: number | null = null;
    let ita: number | null = null;
    let chroma: number | null = null;
    let skinConfident = false;
    if (skinLabs.length >= FACE_MIN_SKIN_PIXELS) {
      const avg = averageLab(skinLabs);
      if (avg) {
        skinLab = avg;
        hueDeg = labHueAngleDeg(avg);
        ita = itaDeg(avg);
        chroma = chromaC(avg);
        skinConfident = skinLabs.length >= MIN_CONFIDENT_SKIN_PIXELS
          && Math.abs(hueDeg - 47) >= MIN_HUE_MARGIN_DEG
          && Math.abs(hueDeg - 57) >= MIN_HUE_MARGIN_DEG;
      }
    }

    // ── Hair: the band above the face box ───────────────────────────────────
    let hairLab: LAB | null = null;
    let hairConfident = false;
    let hairKey: string | null = null;
    if (regions.hairBand) {
      const hairLabsAll = collectRegionLabsFiltered(workingImg, regions.hairBand, gains);
      const dark = darkestFraction(hairLabsAll, HAIR_DARK_FRACTION);
      if (dark.length >= MIN_HAIR_PIXELS) {
        const avg = averageLab(dark);
        if (avg) {
          hairLab = avg;
          const nearest = nearestSwatch(avg, HAIR_LAB);
          if (nearest) {
            hairKey = nearest.key;
            hairConfident = nearest.margin >= HAIR_CONFIDENT_MARGIN;
          }
        }
      }
      // Sparse dark cluster (< MIN_HAIR_PIXELS) → hairLab stays null,
      // hairConfident stays false — the manual 'hair' fallback catches it.
    }

    return { skinLab, hairLab, hueDeg, ita, chroma, scleraCorrected, snrOk, skinConfident, hairConfident, hairKey };
  } catch {
    return null;
  }
}
