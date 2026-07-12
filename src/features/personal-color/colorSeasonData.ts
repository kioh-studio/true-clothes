import type { ColorSeason } from '../../types/profile';
import {
  computeAxes, classifyTone12, TONE12_PARENT, TONE12_PALETTES, TONE12_LABELS,
  TONE12_BOARDS, TONE12_AVOID,
  type ColorTone12, type ToneAxes, type Tone12Inputs, type Tone12Board,
} from './tone12';

// ─── Season palette hex swatches (display only) ────────────────────────────

export const SEASON_PALETTES: Record<ColorSeason, string[]> = {
  spring:  ['#F7C5A0', '#E8956D', '#F2D670', '#88B87A', '#F0E0C8', '#D4A87A', '#EFBF9B', '#C8D89A'],
  summer:  ['#D4B8BC', '#B2C4D8', '#C8B8D8', '#A8C8C0', '#DDD0D0', '#E8CCCC', '#B8C8A8', '#D0BCDC'],
  autumn:  ['#C4622D', '#8B5A2B', '#C48A3A', '#7A8B3A', '#5C3D2E', '#B8874A', '#88522A', '#6B7A3A'],
  winter:  ['#1E3D8B', '#7B1F3A', '#1E6B3A', '#4A1E7B', '#1A1A2E', '#8B0000', '#005073', '#3A1E7B'],
};

// ─── Option types ─────────────────────────────────────────────────────────

export interface SkinOption {
  key: 'warm' | 'cool' | 'neutral';
  swatchHex: string;
  labelEn: string;
  labelVi: string;
  descEn: string;
  descVi: string;
}

export interface HairOption {
  key: string;
  swatchHex: string;
  labelEn: string;
  labelVi: string;
  shade: 'light' | 'medium' | 'dark';
  warmth: 'warm' | 'cool';
}

export interface EyeOption {
  key: 'blue_grey' | 'green_hazel_cool' | 'brown_hazel_warm' | 'dark_brown_black';
  swatchHex: string;
  labelEn: string;
  labelVi: string;
}

export interface MetalOption {
  key: 'gold' | 'silver' | 'both';
  labelEn: string;
  labelVi: string;
  swatchHex: string;
}

// ─── Skin undertone options ────────────────────────────────────────────────

export const SKIN_OPTIONS: SkinOption[] = [
  {
    key: 'warm', swatchHex: '#D4956B',
    labelEn: 'Warm', labelVi: 'Ấm',
    descEn: 'Golden, peachy or yellowish',
    descVi: 'Ánh vàng, đào hoặc ngả vàng',
  },
  {
    key: 'cool', swatchHex: '#C4A0A8',
    labelEn: 'Cool', labelVi: 'Lạnh',
    descEn: 'Pink, rosy or bluish',
    descVi: 'Hồng, hồng đào hoặc ngả xanh',
  },
  {
    key: 'neutral', swatchHex: '#C4AA94',
    labelEn: 'Neutral', labelVi: 'Trung tính',
    descEn: 'No strong undertone',
    descVi: 'Không nghiêng về màu nào rõ ràng',
  },
];

// ─── Hair options ──────────────────────────────────────────────────────────

export const HAIR_OPTIONS: HairOption[] = [
  { key: 'platinum_ash',     swatchHex: '#E8DDD0', labelEn: 'Platinum / Ash', labelVi: 'Bạch kim / Tro',       shade: 'light',  warmth: 'cool' },
  { key: 'golden_blonde',    swatchHex: '#C9A84C', labelEn: 'Golden Blonde',  labelVi: 'Vàng óng',              shade: 'light',  warmth: 'warm' },
  { key: 'auburn_red',       swatchHex: '#9E3A1A', labelEn: 'Red / Auburn',   labelVi: 'Hung / Đỏ nâu',         shade: 'medium', warmth: 'warm' },
  { key: 'brown_warm',       swatchHex: '#7B4A2D', labelEn: 'Warm Brown',     labelVi: 'Nâu ấm',                shade: 'medium', warmth: 'warm' },
  { key: 'brown_cool',       swatchHex: '#7B7063', labelEn: 'Ash / Cool Brown', labelVi: 'Nâu tro / lạnh',      shade: 'medium', warmth: 'cool' },
  { key: 'dark_brown_warm',  swatchHex: '#4A2A18', labelEn: 'Dark Brown (warm)', labelVi: 'Nâu đen ấm',         shade: 'dark',   warmth: 'warm' },
  { key: 'dark_brown_cool',  swatchHex: '#2A1E16', labelEn: 'Dark Brown (cool)', labelVi: 'Nâu đen lạnh',       shade: 'dark',   warmth: 'cool' },
  { key: 'black',            swatchHex: '#120D0B', labelEn: 'Black',           labelVi: 'Đen',                  shade: 'dark',   warmth: 'cool' },
];

// ─── Eye colour options ────────────────────────────────────────────────────

export const EYE_OPTIONS: EyeOption[] = [
  { key: 'blue_grey',          swatchHex: '#7EA8C4', labelEn: 'Blue or Grey',           labelVi: 'Xanh lam / Xám' },
  { key: 'green_hazel_cool',   swatchHex: '#7A9E7A', labelEn: 'Green or Cool Hazel',    labelVi: 'Xanh lục / Nâu xanh lạnh' },
  { key: 'brown_hazel_warm',   swatchHex: '#9E7A50', labelEn: 'Brown or Warm Hazel',    labelVi: 'Nâu / Nâu hổ phách ấm' },
  { key: 'dark_brown_black',   swatchHex: '#3A2010', labelEn: 'Dark Brown or Black',    labelVi: 'Nâu sẫm / Đen' },
];

// ─── Metal preference options ──────────────────────────────────────────────

export const METAL_OPTIONS: MetalOption[] = [
  { key: 'gold',   labelEn: 'Gold',        labelVi: 'Vàng',         swatchHex: '#C9A84C' },
  { key: 'silver', labelEn: 'Silver',      labelVi: 'Bạc',          swatchHex: '#B0AFAD' },
  { key: 'both',   labelEn: 'Both / Neither', labelVi: 'Cả hai / Không', swatchHex: '#A0967E' },
];

// ─── Scoring ───────────────────────────────────────────────────────────────

type Scores = Record<ColorSeason, number>;

function initScores(): Scores { return { spring: 0, summer: 0, autumn: 0, winter: 0 }; }

function scoreSkin(undertone: SkinOption['key']): Scores {
  const s = initScores();
  if (undertone === 'warm') { s.spring += 3; s.autumn += 3; }
  else if (undertone === 'cool') { s.summer += 3; s.winter += 3; }
  else { s.spring += 1; s.summer += 1; s.autumn += 1; s.winter += 1; }
  return s;
}

function scoreHair(key: string): Scores {
  const s = initScores();
  const opt = HAIR_OPTIONS.find(h => h.key === key);
  if (!opt) return s;

  // shade signal
  if (opt.shade === 'light') { s.spring += 2; s.summer += 2; }
  else if (opt.shade === 'dark') { s.autumn += 2; s.winter += 2; }

  // warmth signal
  if (opt.warmth === 'warm') { s.spring += 1; s.autumn += 1; s.summer -= 1; s.winter -= 1; }
  else { s.summer += 1; s.winter += 1; s.spring -= 1; s.autumn -= 1; }

  // special: red/auburn hair → strong spring/autumn signal
  if (key === 'auburn_red') { s.spring += 1; s.autumn += 2; }

  return s;
}

function scoreEye(key: EyeOption['key']): Scores {
  const s = initScores();
  switch (key) {
    case 'blue_grey':         s.summer += 2; s.spring += 1; break;
    case 'green_hazel_cool':  s.winter += 1; s.summer += 1; break;
    case 'brown_hazel_warm':  s.autumn += 2; s.spring += 1; break;
    case 'dark_brown_black':  s.winter += 2; s.autumn += 1; break;
  }
  return s;
}

function scoreMetal(key: MetalOption['key']): Scores {
  const s = initScores();
  if (key === 'gold')   { s.spring += 1; s.autumn += 1; }
  if (key === 'silver') { s.summer += 1; s.winter += 1; }
  return s;
}

function addScores(a: Scores, b: Scores): Scores {
  return {
    spring: a.spring + b.spring,
    summer: a.summer + b.summer,
    autumn: a.autumn + b.autumn,
    winter: a.winter + b.winter,
  };
}

export interface PersonalColorAnswers {
  skinUndertone: SkinOption['key'];
  hairKey?: string;
  eyeKey?: EyeOption['key'];
  metalKey?: MetalOption['key'];
}

export interface PersonalColorResult {
  /** Parent 4-season of the classified 12-tone (`TONE12_PARENT[tone12]`). */
  season: ColorSeason;
  /** Legacy 4-season point scores — still computed from whichever quiz
   *  answers are present, for continuity with anything that reads it. The
   *  winning `season`/`palette` come from the 12-tone axes model, not from
   *  this scorer, so the two can occasionally disagree on a close call. */
  scores: Scores;
  palette: string[];
  /** Grouped 8/12/6 board (neutrals/core/accents) `palette` is flattened from. */
  board: Tone12Board;
  /** Lowercase colour names this tone should generally avoid (engine vocabulary). */
  avoidColors: string[];
  tone12: ColorTone12;
  axes: ToneAxes;
  label: { en: string; vi: string };
}

/** Full 12-tone classification — quiz answers plus optional photo metrics
 *  (skin/hair LAB, wrist hue) and colour-drape adjustments. */
export function scorePersonalColorDetailed(inputs: Tone12Inputs): PersonalColorResult {
  // Legacy 4-season scoring, kept for continuity — computed from whichever
  // answers are present, same logic as before the 12-tone model.
  const parts: Scores[] = [scoreSkin(inputs.skinUndertone)];
  if (inputs.hairKey != null) parts.push(scoreHair(inputs.hairKey));
  if (inputs.eyeKey != null) parts.push(scoreEye(inputs.eyeKey as EyeOption['key']));
  if (inputs.metalKey != null) parts.push(scoreMetal(inputs.metalKey as MetalOption['key']));
  const scores = parts.reduce(addScores, initScores());

  const axes = computeAxes(inputs);
  const tone12 = classifyTone12(axes);
  const season = TONE12_PARENT[tone12];

  return {
    season,
    scores,
    palette: TONE12_PALETTES[tone12],
    board: TONE12_BOARDS[tone12],
    avoidColors: TONE12_AVOID[tone12],
    tone12,
    axes,
    label: TONE12_LABELS[tone12],
  };
}

/** Thin wrapper over `scorePersonalColorDetailed` for manual-quiz-only
 *  callers (no photo metrics/drape) — kept so existing callers/tests don't
 *  need to change shape. */
export function scorePersonalColor(answers: PersonalColorAnswers): PersonalColorResult {
  return scorePersonalColorDetailed({
    skinUndertone: answers.skinUndertone,
    hairKey: answers.hairKey,
    eyeKey: answers.eyeKey,
    metalKey: answers.metalKey,
  });
}

// ─── Season descriptions ───────────────────────────────────────────────────

export const SEASON_DESC: Record<ColorSeason, { en: string; vi: string }> = {
  spring: {
    en: 'Warm, clear and light. You glow in golden yellows, warm corals, and fresh greens.',
    vi: 'Ấm áp, trong sáng và nhẹ nhàng. Bạn tỏa sáng với vàng óng, san hô ấm và xanh tươi.',
  },
  summer: {
    en: 'Cool, muted and soft. Dusty roses, lavender, and powder blues are your best allies.',
    vi: 'Mát lạnh, trầm dịu và nhẹ nhàng. Hồng trầm, oải hương và xanh nhạt là màu của bạn.',
  },
  autumn: {
    en: 'Warm, rich and muted. Burnt oranges, deep olives, and warm browns are your colours.',
    vi: 'Ấm, sâu và trầm. Cam cháy, xanh ôliu đậm và nâu ấm là màu sắc dành cho bạn.',
  },
  winter: {
    en: 'Cool, clear and deep. Crisp whites, deep navy, and jewel tones look striking on you.',
    vi: 'Lạnh, trong và sâu. Trắng tinh, xanh hải quân đậm và màu đá quý nổi bật trên bạn.',
  },
};
