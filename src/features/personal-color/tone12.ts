// 12-tone personal-colour classifier — pure axes model + seasonal lens.
// NO native/Expo imports here (see colorMath.ts header) — importable from Jest
// without a device.
//
// Model: three continuous axes — warmth / value / chroma, each in [-1, 1] —
// derived from quiz answers plus optional on-device photo metrics (skin/hair
// LAB, wrist hue) and optional colour-drape picks. `classifyTone12` then finds
// the dominant axis (largest |value|, tie-broken value > chroma > warmth) and
// maps its sign (plus a secondary sign for the "true_*" case) onto one of the
// 12 tones. Every weighting constant below is a first-cut guess —
// CALIBRATION-PENDING — meant to be tuned against real photos/feedback later,
// not treated as gospel now.

import type { LAB } from './colorMath';
import { rgbToLab, hexToRgb, itaDeg, itaToValueAxis, chromaC } from './colorMath';
import { HAIR_OPTIONS } from './colorSeasonData';
import type { ColorSeason } from '../../types/profile';

export type ColorTone12 =
  | 'light_spring' | 'true_spring' | 'bright_spring'
  | 'light_summer' | 'true_summer' | 'soft_summer'
  | 'soft_autumn'  | 'true_autumn' | 'deep_autumn'
  | 'bright_winter'| 'true_winter' | 'deep_winter';

// ─── Static tone data ───────────────────────────────────────────────────────

export const TONE12_PARENT: Record<ColorTone12, ColorSeason> = {
  light_spring:  'spring', true_spring:  'spring', bright_spring: 'spring',
  light_summer:  'summer', true_summer:  'summer', soft_summer:   'summer',
  soft_autumn:   'autumn', true_autumn:  'autumn', deep_autumn:   'autumn',
  bright_winter: 'winter', true_winter:  'winter', deep_winter:   'winter',
};

export const TONE12_LABELS: Record<ColorTone12, { en: string; vi: string }> = {
  light_spring:  { en: 'Light Spring',  vi: 'Xuân sáng' },
  true_spring:   { en: 'True Spring',   vi: 'Xuân ấm' },
  bright_spring: { en: 'Bright Spring', vi: 'Xuân tươi' },
  light_summer:  { en: 'Light Summer',  vi: 'Hạ sáng' },
  true_summer:   { en: 'True Summer',   vi: 'Hạ dịu' },
  soft_summer:   { en: 'Soft Summer',   vi: 'Hạ trầm' },
  soft_autumn:   { en: 'Soft Autumn',   vi: 'Thu nhẹ' },
  true_autumn:   { en: 'True Autumn',   vi: 'Thu ấm' },
  deep_autumn:   { en: 'Deep Autumn',   vi: 'Thu sâu' },
  bright_winter: { en: 'Bright Winter', vi: 'Đông tươi' },
  true_winter:   { en: 'True Winter',   vi: 'Đông lạnh' },
  deep_winter:   { en: 'Deep Winter',   vi: 'Đông sâu' },
};

// Stylist-grade boards per tone (design lead, 2026-07-06) — 8 neutrals (base
// wardrobe staples), 12 core (the tone's signature palette), 6 accents (small-
// dose statement colours). Draft-curated, DB-authoritative for now — design
// review on-device is pending (see backlog.md §B).
export interface Tone12Board { neutrals: string[]; core: string[]; accents: string[] }

export const TONE12_BOARDS: Record<ColorTone12, Tone12Board> = {
  light_spring: {
    neutrals: ['#F7F2E7', '#F2E6D0', '#EBDCC0', '#DCC69E', '#CFC5B4', '#BFB4A0', '#B29878', '#8F7E66'],
    core: ['#F7C5A0', '#F2A98C', '#F0937E', '#F2D670', '#F5E3A0', '#A8D8B0', '#8FCB9E', '#9AD5CB', '#7AC4D8', '#9AB2E4', '#F2A9BE', '#E8C1D8'],
    accents: ['#FF8C5A', '#FFB347', '#5AC48F', '#4FC4D8', '#FF9AAD', '#FFD75A'],
  },
  true_spring: {
    neutrals: ['#F5EDD8', '#EFDFBE', '#E3CB9C', '#C89F68', '#C4B69B', '#A99270', '#8F7448', '#6E5A3C'],
    core: ['#E8956D', '#F2B950', '#E87A5A', '#F2D670', '#F2C464', '#88B87A', '#5FAF7F', '#7AC474', '#58A8B8', '#3F9ACB', '#E86E8A', '#D88C5A'],
    accents: ['#FF6E3C', '#FFC02E', '#2FB873', '#2FA8D8', '#FF5A7A', '#FFE04C'],
  },
  bright_spring: {
    neutrals: ['#FAF4E6', '#F0E4CC', '#DCC69E', '#C4A06E', '#C8C0B0', '#A8987C', '#7E6A4E', '#57493A'],
    core: ['#F26D4F', '#FFC24C', '#FF8C3C', '#FFE066', '#4FB88A', '#2FC474', '#3FA8D8', '#28B8C8', '#F2547A', '#FF7AA0', '#8C6FD8', '#66C4A8'],
    accents: ['#FF4C2E', '#FFD028', '#00B85F', '#00A8E8', '#FF3C6E', '#7A4FE8'],
  },
  light_summer: {
    neutrals: ['#F4F2F0', '#E8E6E4', '#D8D8DC', '#C4CBD6', '#B8A6A4', '#A8AEB8', '#8A96A8', '#6E7B8C'],
    core: ['#D4B8BC', '#E8CCCC', '#C8B8D8', '#B2C4D8', '#A8C8C0', '#9AB8D0', '#B8C8A8', '#D8C0D0', '#A8B8E0', '#C4A8C8', '#98BFC6', '#DDD0DD'],
    accents: ['#8FA8D8', '#B08FC8', '#7AB8B0', '#E8A0B0', '#98C0E8', '#C88FB8'],
  },
  true_summer: {
    neutrals: ['#F2F0EE', '#DDDCE0', '#C0C6D0', '#AEBACD', '#A89EA0', '#8C96A8', '#5C6B84', '#46536B'],
    core: ['#B08FA8', '#7A9AB8', '#C49AA4', '#7AA89A', '#9A8FB8', '#6D8FA8', '#B29AA0', '#8FA8C4', '#A87A96', '#6B8FA0', '#C4B2C8', '#96A8B8'],
    accents: ['#8F6FA8', '#4C7A9E', '#B85C8A', '#4C8F84', '#6F7AB8', '#A85C7A'],
  },
  soft_summer: {
    neutrals: ['#F0EEEC', '#DCD8D6', '#C4C0BE', '#A89E96', '#9AA0A4', '#8A8A92', '#6E6E78', '#54545E'],
    core: ['#A89AA4', '#8FA0A8', '#B8A4A8', '#90A092', '#9A94A8', '#B0A8B0', '#7A8A94', '#A89890', '#9E8A96', '#7E909A', '#8E9E90', '#B0A098'],
    accents: ['#8A6F84', '#5C7A88', '#A87A8A', '#5C8578', '#6E6F92', '#96707E'],
  },
  soft_autumn: {
    neutrals: ['#F0E8D8', '#E0D4BC', '#C8B8A0', '#B0A084', '#9C8C70', '#8A7A5E', '#6E6248', '#544C3A'],
    core: ['#B89A7A', '#C4A487', '#A88F6D', '#8F9A6D', '#B0876D', '#C8B294', '#94886D', '#A87F5C', '#A8A07A', '#C49A8A', '#8A9478', '#B8A68A'],
    accents: ['#B87A4C', '#8F9E4C', '#A85C48', '#6E8A5C', '#C48A5A', '#8A6E7E'],
  },
  true_autumn: {
    neutrals: ['#F0E2C8', '#E0CCA0', '#C8A87A', '#B8905C', '#8C6A3F', '#6E5843', '#5A4634', '#4A4030'],
    core: ['#C4622D', '#C48A3A', '#8B5A2B', '#B8874A', '#7A8B3A', '#6B7A3A', '#A0522D', '#88522A', '#C49A2E', '#8F6E2E', '#B06E3C', '#5C6E2E'],
    accents: ['#D85A1E', '#C49A00', '#7A8F1E', '#A83C1E', '#8F5C00', '#4C6E28'],
  },
  deep_autumn: {
    neutrals: ['#E8D8B8', '#C8AC84', '#A8845C', '#7A5C3C', '#5C4022', '#4A3828', '#3E2E20', '#2E241A'],
    core: ['#7A3A1E', '#8B4513', '#6B2D1E', '#8B6914', '#4A5228', '#3E5228', '#5C3D2E', '#6E2E28', '#7A5228', '#8A3E14', '#6E3A2E', '#5C2E3C'],
    accents: ['#A8321E', '#B87400', '#5C7A1E', '#7A1E28', '#8F4C00', '#3C5C28'],
  },
  bright_winter: {
    neutrals: ['#FAFAFC', '#E4E6EE', '#C8C8D0', '#9A9AA4', '#55505A', '#3A3A40', '#1E2A48', '#111114'],
    core: ['#1E5AC8', '#C81E5A', '#00A0A8', '#7A1EC8', '#E81E3C', '#00B4D8', '#C800A0', '#1EC87A', '#2E3E9E', '#A80048', '#008FC8', '#5A00A8'],
    accents: ['#FF1E5A', '#00C8E8', '#28E88C', '#B800E8', '#F2E82E', '#0057FF'],
  },
  true_winter: {
    neutrals: ['#FAFAFA', '#E8EAF0', '#C8CCD8', '#8F94A2', '#4A4E5C', '#2E3242', '#1A1E30', '#0F0F14'],
    core: ['#1E3D8B', '#7B1F3A', '#1E6B3A', '#4A1E7B', '#8B0000', '#005073', '#3A1E7B', '#1A1A2E', '#8F0F3C', '#0F4C64', '#28285C', '#5C0F28'],
    accents: ['#E80F3C', '#0F5CC8', '#0F8F5C', '#8F0FC8', '#C80F8F', '#0FC8C8'],
  },
  deep_winter: {
    neutrals: ['#F4F4F6', '#D8DCE4', '#A8ACB8', '#6E7280', '#3C4050', '#26283A', '#161A2C', '#0C0C12'],
    core: ['#14275C', '#4F1428', '#143C28', '#2E1450', '#5C0A0A', '#002E42', '#26144F', '#0F0F1E', '#3C1432', '#0F2E50', '#421428', '#142842'],
    accents: ['#8F0F28', '#0F3C8F', '#0F6444', '#5C0F8F', '#B80F50', '#0F5C74'],
  },
};

// UX-simplify (2026-08-06): i18n key per tone for the result hero's
// plain-language one-liner (`docs/personal-color-ux-simplify-instruction.md`
// §8) — pure string mapping, NOT part of the classification math. Copy lives
// in en.json/vi.json under these exact keys.
export const TONE12_DESC_KEY: Record<ColorTone12, string> = {
  light_spring:  'tone12Desc_light_spring',
  true_spring:   'tone12Desc_true_spring',
  bright_spring: 'tone12Desc_bright_spring',
  light_summer:  'tone12Desc_light_summer',
  true_summer:   'tone12Desc_true_summer',
  soft_summer:   'tone12Desc_soft_summer',
  soft_autumn:   'tone12Desc_soft_autumn',
  true_autumn:   'tone12Desc_true_autumn',
  deep_autumn:   'tone12Desc_deep_autumn',
  bright_winter: 'tone12Desc_bright_winter',
  true_winter:   'tone12Desc_true_winter',
  deep_winter:   'tone12Desc_deep_winter',
};

// Derived flat palette (26 hexes: neutrals → core → accents) — every existing
// consumer of TONE12_PALETTES (result.palette, savePersonalColor →
// personal_palette, seasonalEdit) automatically gets the richer board without
// any call-site change.
export const TONE12_PALETTES: Record<ColorTone12, string[]> = Object.fromEntries(
  (Object.keys(TONE12_BOARDS) as ColorTone12[]).map(tone => {
    const board = TONE12_BOARDS[tone];
    return [tone, [...board.neutrals, ...board.core, ...board.accents]];
  }),
) as Record<ColorTone12, string[]>;

// Phase B — the single most-signature drape colour per tone, used as the grid
// compare's backing panel (DrapeSession's "SEE ALL 12 TONES" phase). Default
// is `core[2]` of each tone's board; hand-checked visually against
// TONE12_BOARDS and overridden where core[2] reads dull. CALIBRATION-PENDING
// (design lead review pending, same as every other hex in this file).
export const TONE12_DRAPE_HEX: Record<ColorTone12, string> = {
  light_spring:  TONE12_BOARDS.light_spring.core[2],   // '#F0937E' peach coral — vivid, on-brand
  true_spring:   TONE12_BOARDS.true_spring.core[2],    // '#E87A5A' warm coral-red
  bright_spring: TONE12_BOARDS.bright_spring.core[2],  // '#FF8C3C' vivid orange
  light_summer:  TONE12_BOARDS.light_summer.core[2],   // '#C8B8D8' soft lavender
  true_summer:   TONE12_BOARDS.true_summer.core[2],    // '#C49AA4' dusty rose
  soft_summer:   TONE12_BOARDS.soft_summer.core[2],    // '#B8A4A8' muted mauve
  soft_autumn:   TONE12_BOARDS.soft_autumn.core[2],    // '#A88F6D' muted khaki-brown
  // OVERRIDE: core[2] ('#8B5A2B', a flat plain brown) reads dull next to the
  // other tones' signature swatches — core[0] ('#C4622D', rust/pumpkin) is
  // far more recognisably "True Autumn".
  true_autumn:   TONE12_BOARDS.true_autumn.core[0],    // '#C4622D' rust/pumpkin
  deep_autumn:   TONE12_BOARDS.deep_autumn.core[2],    // '#6B2D1E' dark brick
  bright_winter: TONE12_BOARDS.bright_winter.core[2],  // '#00A0A8' teal
  true_winter:   TONE12_BOARDS.true_winter.core[2],    // '#1E6B3A' emerald
  deep_winter:   TONE12_BOARDS.deep_winter.core[2],    // '#143C28' forest green
};

// The engine's PrimaryColor vocabulary (supabase/functions/generate-outfits/
// engine/types.ts) — duplicated here as plain strings since this client module
// can't import a Deno-only server file. Keep in sync manually; the server has
// its own copy of TONE12_AVOID typed as PrimaryColor[] (scoring.ts), which
// fails to compile if it drifts from the real union.
const ENGINE_PRIMARY_COLORS = new Set([
  'black', 'white', 'navy', 'beige', 'gray', 'brown', 'olive',
  'blue', 'red', 'purple', 'green', 'yellow', 'pink', 'orange',
  'cream', 'ivory', 'camel', 'tan', 'taupe', 'khaki', 'charcoal',
  'burgundy', 'teal', 'metallic', 'multicolor', 'natural',
  // +11 vocabulary expansion (2026-07-06) — kept in sync with the engine's
  // PrimaryColor union (supabase/functions/generate-outfits/engine/types.ts).
  'mustard', 'rust', 'coral', 'mint', 'lavender', 'sage',
  'terracotta', 'mauve', 'wine', 'fuchsia', 'denim',
]);

// Draft-curated "better to skip" colour NAMES per tone (design lead,
// 2026-07-06) — lowercase engine vocabulary; the result screens also display
// these as plain text (no swatches). Filtered at module init against
// ENGINE_PRIMARY_COLORS above — any name the scoring engine has no concept of
// is silently dropped (was 'mustard'/'rust'/'fuchsia' until the +11 vocabulary
// expansion added them to ENGINE_PRIMARY_COLORS above; they now pass through).
const TONE12_AVOID_RAW: Record<ColorTone12, string[]> = {
  light_spring:  ['black', 'charcoal', 'burgundy', 'navy'],
  true_spring:   ['black', 'charcoal', 'burgundy', 'navy'],
  bright_spring: ['olive', 'beige', 'brown', 'charcoal'],
  light_summer:  ['orange', 'rust', 'mustard', 'camel', 'black'],
  true_summer:   ['orange', 'rust', 'mustard', 'olive', 'black'],
  soft_summer:   ['orange', 'rust', 'black', 'fuchsia'],
  soft_autumn:   ['black', 'fuchsia', 'pink', 'navy'],
  true_autumn:   ['black', 'navy', 'pink', 'fuchsia'],
  deep_autumn:   ['pink', 'fuchsia', 'gray', 'navy'],
  bright_winter: ['beige', 'camel', 'mustard', 'olive', 'orange'],
  true_winter:   ['orange', 'brown', 'beige', 'camel', 'mustard'],
  deep_winter:   ['camel', 'orange', 'beige', 'mustard'],
};

export const TONE12_AVOID: Record<ColorTone12, string[]> = Object.fromEntries(
  (Object.keys(TONE12_AVOID_RAW) as ColorTone12[]).map(tone => [
    tone,
    TONE12_AVOID_RAW[tone].filter(name => ENGINE_PRIMARY_COLORS.has(name)),
  ]),
) as Record<ColorTone12, string[]>;

// ─── Axes model ─────────────────────────────────────────────────────────────

/** warmth: + = warm, − = cool. value: + = light, − = deep. chroma: + = bright/clear, − = soft/muted. All in [-1, 1]. */
export interface ToneAxes {
  warmth: number;
  value: number;
  chroma: number;
}

export interface Tone12Inputs {
  skinUndertone: 'warm' | 'cool' | 'neutral';
  hairKey?: string;
  eyeKey?: string;
  metalKey?: string;
  skinLab?: LAB | null;
  hairLab?: LAB | null;
  /** Calibrated skin hue angle (deg) — face-primary when a face scan landed,
   *  falling back to wrist hue otherwise (see usePersonalColorDetection's
   *  `combineSkinReads`). Renamed from the v2 `wristHueDeg` now that the face
   *  is the primary sample site (v3 phase A) — still the same axis-model
   *  role, just fed by whichever site actually classified. */
  skinHueDeg?: number | null;
  drape?: Partial<ToneAxes>;
}

function clamp(n: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, n));
}

// CALIBRATION-PENDING—v3: degrees past whichever of the classifyUndertone
// thresholds (47/57) the hue is already on the far side of, normalized /10
// and clamped to 1 — a hue just past the threshold barely nudges warmth,
// one comfortably past it saturates the nudge. Replaces v2's raw
// distance-from-52° formula now that the hue is calibrated (sclera-corrected
// face read, not just a raw wrist pixel average).
function hueMargin(hueDeg: number): number {
  const pastWarm = hueDeg - 57;
  const pastCool = 47 - hueDeg;
  const past = Math.max(pastWarm, pastCool, 0);
  return clamp(past / 10, 0, 1);
}

export function computeAxes(inputs: Tone12Inputs): ToneAxes {
  const hairOpt = inputs.hairKey != null ? HAIR_OPTIONS.find(h => h.key === inputs.hairKey) : undefined;

  // ── warmth ──────────────────────────────────────────────────────────────
  // CALIBRATION-PENDING: base signal is the quiz's own undertone answer (on
  // the camera path this is itself already derived from the calibrated hue —
  // see combineSkinReads in usePersonalColorDetection.ts).
  let warmth = inputs.skinUndertone === 'warm' ? 0.5 : inputs.skinUndertone === 'cool' ? -0.5 : 0;
  // CALIBRATION-PENDING—v3: calibrated skin hue nudges warmth further, shaped
  // by its margin past the undertone threshold (see hueMargin above) rather
  // than a raw linear distance from the midpoint — max swing kept at ±0.35,
  // same envelope as v2.
  if (inputs.skinHueDeg != null) {
    const sign = inputs.skinHueDeg >= 52 ? 1 : -1;
    warmth += sign * hueMargin(inputs.skinHueDeg) * 0.35;
  }
  // CALIBRATION-PENDING: hair warmth is a supporting signal.
  if (hairOpt) warmth += hairOpt.warmth === 'warm' ? 0.25 : -0.25;
  // CALIBRATION-PENDING: eye colour is a light supporting signal.
  if (inputs.eyeKey === 'brown_hazel_warm') warmth += 0.15;
  if (inputs.eyeKey === 'blue_grey' || inputs.eyeKey === 'green_hazel_cool') warmth -= 0.15;
  // CALIBRATION-PENDING: metal preference (gold reads warm, silver reads cool).
  if (inputs.metalKey === 'gold') warmth += 0.1;
  if (inputs.metalKey === 'silver') warmth -= 0.1;
  warmth = clamp(warmth);

  // ── value (light ↔ deep) ─────────────────────────────────────────────────
  // CALIBRATION-PENDING: quiz-side signal — hair shade leads, skin lightness
  // and eye colour support. Kept as its own term so the manual-only path
  // (no photo metrics at all) is completely unchanged.
  let quizValue = hairOpt ? (hairOpt.shade === 'light' ? 0.6 : hairOpt.shade === 'dark' ? -0.6 : 0) : 0;
  if (inputs.skinLab) quizValue += clamp((inputs.skinLab.L - 55) / 60, -0.25, 0.25);
  if (inputs.eyeKey === 'blue_grey') quizValue += 0.15;
  if (inputs.eyeKey === 'dark_brown_black') quizValue -= 0.15;
  quizValue = clamp(quizValue);
  // CALIBRATION-PENDING—v3: when a photo skin LAB is available, derive its
  // ITA° and anchor the value axis on the published clinical bands
  // (`itaToValueAxis`), blended with the quiz-side signal 0.7/0.3 (photo-led,
  // quiz as a light tiebreaker) — per docs/personal-color-v3-research.md
  // §4.4. No skin LAB (manual-only path, or a scan that never landed a skin
  // read) → quizValue alone, unchanged from v2.
  let value = inputs.skinLab != null
    ? clamp(itaToValueAxis(itaDeg(inputs.skinLab)) * 0.7 + quizValue * 0.3)
    : quizValue;
  value = clamp(value);

  // ── chroma (bright/clear ↔ soft/muted) ───────────────────────────────────
  // CALIBRATION-PENDING: skin↔hair lightness contrast is the strongest known
  // quiz-side proxy for "clear vs blended" — high contrast reads bright/
  // clear, low contrast reads soft/muted. Without both photo LABs there's no
  // contrast signal, so this term is 0 on the manual-only path.
  let contrastTerm = 0;
  if (inputs.skinLab && inputs.hairLab) {
    const contrast = Math.abs(inputs.skinLab.L - inputs.hairLab.L);
    contrastTerm = clamp((contrast - 35) / 30, -0.5, 0.5);
  }
  // CALIBRATION-PENDING—v3: skin C*ab as a direct chroma signal, blended
  // 50/50 with the lightness-contrast proxy above when both are available
  // (photo-only when there's no hair LAB to contrast against). Anchor (20)
  // and spread (20) are first-cut guesses pending real photo calibration —
  // see docs/personal-color-v3-research.md §4.4.
  let chroma: number;
  if (inputs.skinLab) {
    const photoChromaTerm = clamp((chromaC(inputs.skinLab) - 20) / 20, -1, 1);
    chroma = inputs.hairLab ? photoChromaTerm * 0.5 + contrastTerm * 0.5 : photoChromaTerm;
  } else {
    chroma = contrastTerm;
  }
  if (inputs.eyeKey === 'blue_grey' || inputs.eyeKey === 'dark_brown_black') chroma += 0.15; // clear
  if (inputs.eyeKey === 'green_hazel_cool' || inputs.eyeKey === 'brown_hazel_warm') chroma -= 0.15; // blended
  if (inputs.hairKey === 'auburn_red') chroma += 0.1;
  chroma = clamp(chroma);

  // ── colour-drape refinement (accumulated "which looks better" picks) ────
  if (inputs.drape) {
    if (inputs.drape.warmth != null) warmth += inputs.drape.warmth;
    if (inputs.drape.value  != null) value  += inputs.drape.value;
    if (inputs.drape.chroma != null) chroma += inputs.drape.chroma;
  }

  return { warmth: clamp(warmth), value: clamp(value), chroma: clamp(chroma) };
}

/** Confidence bucket from the axes' minimum absolute margin — the axis
 *  closest to 0 is the "weakest link" in the read, so it (not the average or
 *  the dominant axis) sets the overall confidence. */
export type Tone12Confidence = 'high' | 'medium' | 'low';

export interface Tone12Classification {
  tone: ColorTone12;
  /** The neighbour tone that would result if the single lowest-margin axis
   *  flipped sign — i.e. "how this read could plausibly go the other way."
   *  Null when flipping that axis doesn't actually change the outcome tone
   *  (the other axes are decisive enough on their own). */
  secondary: ColorTone12 | null;
  confidence: Tone12Confidence;
}

function classifyTone12Core(axes: ToneAxes): ColorTone12 {
  const { warmth, value, chroma } = axes;

  // CALIBRATION-PENDING: an all-zero read (no signal at all) has no dominant
  // characteristic to key off — fall back to the most neutral/muted tone
  // rather than an arbitrary pick.
  if (warmth === 0 && value === 0 && chroma === 0) return 'soft_summer';

  // Dominant-characteristic method: the axis with the largest magnitude
  // decides the tone family (light/deep, bright/soft, or "true"). Ties break
  // value > chroma > warmth.
  const absValue = Math.abs(value), absChroma = Math.abs(chroma), absWarmth = Math.abs(warmth);
  const dominant: 'value' | 'chroma' | 'warmth' =
    absValue >= absChroma && absValue >= absWarmth ? 'value'
    : absChroma >= absWarmth ? 'chroma'
    : 'warmth';

  if (dominant === 'value') {
    if (value > 0) return warmth >= 0 ? 'light_spring' : 'light_summer';
    return warmth >= 0 ? 'deep_autumn' : 'deep_winter';
  }
  if (dominant === 'chroma') {
    if (chroma > 0) return warmth >= 0 ? 'bright_spring' : 'bright_winter';
    return warmth >= 0 ? 'soft_autumn' : 'soft_summer';
  }
  // dominant === 'warmth' — split the warm/cool "true" pair by the classic
  // secondary pairings: spring = warm·clear·light, autumn = warm·muted·deep,
  // summer = cool·muted·light, winter = cool·clear·deep. So on the warm side,
  // light AND clear both lean Spring while deep AND muted both lean Autumn
  // (value + chroma together, not chroma alone — warm undertone with deep
  // colouring is the textbook True/Deep Autumn, never Spring); mirrored on
  // the cool side, where clear AND deep lean Winter, soft AND light lean
  // Summer.
  if (warmth > 0) {
    const springness = value + chroma;
    return springness >= 0 ? 'true_spring' : 'true_autumn';
  }
  const winterness = chroma - value;
  return winterness >= 0 ? 'true_winter' : 'true_summer';
}

// CALIBRATION-PENDING—v3: bucket thresholds on the minimum axis margin —
// ≥0.5 reads as a comfortably clear axis ("high"), ≥0.2 as legible but not
// emphatic ("medium"), anything closer to 0 as genuinely ambiguous ("low").
const CONFIDENCE_HIGH_MARGIN = 0.5;
const CONFIDENCE_MEDIUM_MARGIN = 0.2;

function confidenceFromMargin(margin: number): Tone12Confidence {
  if (margin >= CONFIDENCE_HIGH_MARGIN) return 'high';
  if (margin >= CONFIDENCE_MEDIUM_MARGIN) return 'medium';
  return 'low';
}

/**
 * Classifies the 12-tone from the axes model, plus a "leaning" secondary
 * neighbour and an overall confidence bucket — both derived from the single
 * axis with the smallest absolute margin (the read's weakest link):
 *   - `confidence` buckets that margin directly (see thresholds above).
 *   - `secondary` recomputes the classification with that one axis' sign
 *     flipped; if the resulting tone differs, that's the plausible
 *     neighbour the read could tip into with a slightly different sample.
 */
export function classifyTone12(axes: ToneAxes): Tone12Classification {
  const tone = classifyTone12Core(axes);

  const entries: Array<[keyof ToneAxes, number]> = [
    ['warmth', axes.warmth], ['value', axes.value], ['chroma', axes.chroma],
  ];
  const [weakestAxis, weakestValue] = entries.reduce((a, b) => (Math.abs(b[1]) < Math.abs(a[1]) ? b : a));
  const minMargin = Math.abs(weakestValue);

  const flipped: ToneAxes = { ...axes, [weakestAxis]: -weakestValue };
  const flippedTone = classifyTone12Core(flipped);
  const secondary = flippedTone !== tone ? flippedTone : null;

  return { tone, secondary, confidence: confidenceFromMargin(minMargin) };
}

// ─── Colour-drape picks ─────────────────────────────────────────────────────

// CALIBRATION-PENDING: how much a single "which drape looks better" pick
// shifts an axis.
export const DRAPE_STEP = 0.4;

export type DrapeAxis = 'warmth' | 'value' | 'chroma';

export function applyDrapePick(
  current: Partial<ToneAxes>,
  axis: DrapeAxis,
  direction: 1 | -1,
): Partial<ToneAxes> {
  const next = clamp((current[axis] ?? 0) + direction * DRAPE_STEP);
  return { ...current, [axis]: next };
}

// ─── 12-tone grid compare — nudgeTowardTone (Phase B) ──────────────────────

// CALIBRATION-PENDING—v3: canonical warmth/value/chroma SIGN pattern per
// tone, built from the classic 12-season definitions summarised in
// docs/personal-color-v3-research.md §2 (spring = warm·clear·light, summer =
// cool·muted·light, autumn = warm·muted·deep, winter = cool·clear·deep) and
// cross-checked against classifyTone12Core's own decision boundaries — every
// row below, run back through classifyTone12Core, reproduces its own tone
// (see tone12.test.ts). Magnitudes are illustrative only (the deciding axis
// at ±1, supporting axes smaller) — nudgeTowardTone below reads only the
// SIGN of each axis, never the magnitude.
const TONE12_AXIS_SIGNATURE: Record<ColorTone12, ToneAxes> = {
  light_spring:  { warmth: 0.3,  value: 1,    chroma: 0.4 },
  true_spring:   { warmth: 1,    value: 0.3,  chroma: 0.5 },
  bright_spring: { warmth: 0.3,  value: 0.2,  chroma: 1 },
  light_summer:  { warmth: -0.3, value: 1,    chroma: -0.4 },
  true_summer:   { warmth: -1,   value: 0.2,  chroma: -0.4 },
  soft_summer:   { warmth: -0.3, value: -0.1, chroma: -1 },
  soft_autumn:   { warmth: 0.3,  value: 0.1,  chroma: -1 },
  true_autumn:   { warmth: 1,    value: -0.3, chroma: -0.5 },
  deep_autumn:   { warmth: 0.3,  value: -1,   chroma: 0.3 },
  bright_winter: { warmth: -0.3, value: 0.1,  chroma: 1 },
  true_winter:   { warmth: -1,   value: -0.3, chroma: 0.5 },
  deep_winter:   { warmth: -0.3, value: -1,   chroma: 0.3 },
};

/**
 * Nudges the accumulated drape axes ONE `applyDrapePick` step toward `to`,
 * for each axis where `to`'s canonical sign (`TONE12_AXIS_SIGNATURE`)
 * differs from `from`'s. A grid tap in the "SEE ALL 12 TONES" compare view
 * calls this instead of re-implementing the axis math — it makes a single
 * grid pick exactly as strong as one drape-round pick (never a teleport to
 * the tapped tone in one tap). No-op (returns `current` unchanged) when
 * `from`/`to` share every axis' sign.
 */
export function nudgeTowardTone(
  current: Partial<ToneAxes>,
  from: ColorTone12,
  to: ColorTone12,
): Partial<ToneAxes> {
  const fromSig = TONE12_AXIS_SIGNATURE[from];
  const toSig = TONE12_AXIS_SIGNATURE[to];
  let next = current;
  (['warmth', 'value', 'chroma'] as DrapeAxis[]).forEach(axis => {
    const fromSign = Math.sign(fromSig[axis]);
    const toSign = Math.sign(toSig[axis]);
    if (toSign !== 0 && toSign !== fromSign) {
      next = applyDrapePick(next, axis, toSign as 1 | -1);
    }
  });
  return next;
}

// ─── Seasonal lens (display-level, pure) ───────────────────────────────────

/** Reorders a tone's palette for "this season's edit" — the leading swatches
 *  match what tends to read best in the current weather season. Pure UI
 *  ordering, not a re-classification of the tone itself. */
export function seasonalEdit(palette: string[], weather: ColorSeason): { ordered: string[]; edit: string[] } {
  const withMetrics = palette.map((hex, index) => {
    const rgb = hexToRgb(hex);
    const lab = rgbToLab(rgb);
    const chromaProxy = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
    return { hex, index, L: lab.L, chromaProxy, warmProxy: lab.b };
  });

  const sorted = [...withMetrics].sort((x, y) => {
    let diff: number;
    switch (weather) {
      case 'summer': diff = y.L - x.L; break;                     // lightest first
      case 'winter': diff = x.L - y.L; break;                     // deepest first
      case 'spring': diff = y.chromaProxy - x.chromaProxy; break; // most chromatic first
      case 'autumn': diff = y.warmProxy - x.warmProxy; break;     // warmest first
    }
    return diff !== 0 ? diff : x.index - y.index; // deterministic tie-break
  });

  const ordered = sorted.map(s => s.hex);
  return { ordered, edit: ordered.slice(0, 4) };
}

// Southern-hemisphere countries — calendar seasons run 6 months opposite the
// northern mapping below.
const SOUTHERN_HEMISPHERE_CODES = new Set([
  'AU', 'NZ', 'AR', 'CL', 'UY', 'PY', 'BO', 'PE', 'ZA', 'BW', 'NA', 'ZW', 'MZ', 'MG', 'FJ',
]);

/** Rough "what season is it right now" for display copy (e.g. "this season's
 *  edit"). Display-level lens only — the wardrobe-critic engine computes its
 *  own weather season server-side from live weather data; this is not that. */
export function weatherSeasonNow(countryCode?: string | null, date: Date = new Date()): ColorSeason {
  const month = date.getMonth(); // 0-11
  const northern: ColorSeason =
    month >= 2 && month <= 4 ? 'spring'
    : month >= 5 && month <= 7 ? 'summer'
    : month >= 8 && month <= 10 ? 'autumn'
    : 'winter';

  if (!countryCode || !SOUTHERN_HEMISPHERE_CODES.has(countryCode.toUpperCase())) return northern;

  const OPPOSITE: Record<ColorSeason, ColorSeason> = {
    spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer',
  };
  return OPPOSITE[northern];
}
