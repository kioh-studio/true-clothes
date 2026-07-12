// On-device colour analysis for the personal-colour camera path.
// Reads the dominant tone from the wrist / hair photo and maps it to the quiz's
// controlled options (so the camera ACTUALLY contributes, not just decorates).
//
// Pipeline (all on-device, no remote AI): expo-image-manipulator downscales the
// photo to a tiny 48×48 tile → jpeg-js decodes it to RGBA → we collect
// per-pixel LAB samples from the central 50% region (skipping near-black
// shadow and blown-out flash glare pixels), then:
//   - wrist → filter to a generous skin-colour gamut and classify undertone by
//     LAB hue angle on the average of the surviving pixels; if too few pixels
//     look like skin (bad framing/lighting), fall back to nearest-swatch
//     matching on the plain (unfiltered) average instead;
//   - hair → cluster on the darkest 40% of sampled pixels (the UI has the user
//     hold hair against a light background, so the hair itself is the dark
//     cluster) and match the nearest controlled swatch, with a margin-based
//     confidence score.
//
// Both functions also surface the raw LAB average (and, for the wrist, the
// hue angle) they classified from — the 12-tone axes model (tone12.ts) uses
// these as continuous inputs (skin/hair contrast, wrist hue) alongside the
// discrete quiz-option keys.
//
// Every step is wrapped so a failure returns null → the quiz simply stays manual.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { SKIN_OPTIONS, HAIR_OPTIONS, type SkinOption } from './colorSeasonData';
import {
  rgbToLab, hexToRgb, isSkinPixelLab, classifyUndertone, averageLab,
  darkestFraction, nearestSwatch, labHueAngleDeg,
  type LAB,
} from './colorMath';

// ── base64 JPEG → RGBA ───────────────────────────────────────────────────────

function decodeJpeg(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64); // Hermes provides atob on Expo 54
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // useTArray → return a Uint8Array (RN has no Node Buffer)
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// Collect per-pixel LAB samples from the central 50% region, skipping
// near-black (shadow/background) and blown-out flash glare pixels so they
// don't pollute the sample. Glare rejection uses the BRIGHTEST channel (mx)
// so that specular highlights — which rarely go pure-white on every channel
// but will spike the peak — are reliably trimmed.
function collectCentralLabs(img: { width: number; height: number; data: Uint8Array }): LAB[] {
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
  try {
    const res = await manipulateAsync(uri, [{ resize: { width: 48, height: 48 } }], {
      base64: true, compress: 0.9, format: SaveFormat.JPEG,
    });
    if (!res.base64) return null;
    return collectCentralLabs(decodeJpeg(res.base64));
  } catch {
    return null; // any decode/manipulate failure → caller falls back to manual
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

// ── Public: map a photo to a quiz option ─────────────────────────────────────

/** Wrist photo → skin undertone + a confidence flag + the raw LAB/hue metrics
 *  the classification was based on (used as continuous axes-model inputs). */
export async function analyzeWristUndertone(
  uri: string,
): Promise<{ key: SkinOption['key']; confident: boolean; skinLab: LAB | null; hueDeg: number | null } | null> {
  const labs = await sampleCentralLabs(uri);
  if (!labs) return null;

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

  // Fallback: too few pixels read as skin (poor framing/lighting) — match the
  // nearest SKIN_OPTIONS swatch on the a/b chroma plane of the plain
  // (unfiltered) average instead, since phone auto-white-balance shifts
  // brightness far more than hue. Always reported as low-confidence.
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
