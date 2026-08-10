// Verdict scoring for a single prospective item against the current user's profile.
// Each of the five criteria scores 0–100. Unavailable criteria (missing item attr
// OR missing profile datum) are excluded and weights are renormalized over the rest.
// Deterministic — no LLM. Reuses engine helpers from generate-outfits/engine/.

import {
  FitItem, BodyMeasurements, BodyShape, Season,
} from '../generate-outfits/engine/types.ts';
import {
  computeUserAttributes,
  scoreStyleCoherence,
  scoreItemFit,
  bodyShapeAdjustment,
  TONE12_AVOID,
  scoreFitPreference,
  paletteAlignment,
  seasonCompatibilityBonus,
  weatherSeasonColorBonus,
  tone12QualityBonus,
  tone12AvoidPenalty,
  SEASON_COMPAT,
} from '../generate-outfits/engine/scoring.ts';
import { colorProfileOf } from '../generate-outfits/engine/enrichment.ts';
import { styleConfigById } from '../generate-outfits/engine/filtering.ts';
import type { Locale } from './note.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CriterionKey = 'color' | 'style' | 'fit' | 'measurement' | 'fabric';
export type Recommendation = 'great' | 'worth_it' | 'maybe' | 'skip';

export interface CriterionScore {
  key: CriterionKey;
  available: boolean;
  score: number | null;
  weight: number;
  explanation: string;
}

export interface VerdictResult {
  overall_score: number | null;
  recommendation: Recommendation | null;
  criteria: CriterionScore[];
}

// ─── Default criterion weights (tunable) ─────────────────────────────────────

const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  fit:         0.25,
  measurement: 0.25,
  color:       0.20,
  style:       0.20,
  fabric:      0.10,
};

// ─── Recommendation bands ─────────────────────────────────────────────────────

function toRecommendation(score: number): Recommendation {
  if (score >= 85) return 'great';
  if (score >= 70) return 'worth_it';
  if (score >= 50) return 'maybe';
  return 'skip';
}

// ─── Preferred fit comparison ─────────────────────────────────────────────────
// Compares item fit (lowercase) vs user preferredFit (UPPERCASE enum).
// Returns 0–1 raw score. FIT_COMPAT + scoreFitPreference themselves now live in
// the engine (scoring.ts, 2026-08-03 fit-relative-ease session) so
// generate-outfits can anchor the feed to the same preference table;
// scoreFitPreference is imported above. Local type aliases kept only for this
// file's own signatures below (structurally identical to the engine's types).

type PreferredFit = 'SLIM' | 'REGULAR' | 'RELAXED' | 'OVERSIZED';
type ItemFitStr = 'slim' | 'regular' | 'relaxed' | 'wide' | 'oversized';

// ═══════════════════════════════════════════════════════════════════════════
// Single-item colour & fabric scorers (2026-08-06 — evaluate-item phase 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// scoreColorHarmony/scoreSeasonMatch (engine/scoring.ts) score OUTFITS —
// several garments at once — so most of their sub-terms measure relationships
// BETWEEN items (hue pairing, undertone spread across pieces, tonal contrast,
// graphic density, internal fabric-season consistency…). Fed a single-item
// array, those sub-terms all degenerate to a constant (see docs/
// engine-fixes-phase2-instruction.md Fix 1 for the derivation):
//   colour base  = 0.20·paletteAlignment + 0.705            (a 70.5–90.5 band)
//   fabric raw   = 0.6·targetMatch + 0.4·0.8, clamped to     [32, 92]
// i.e. a single scanned item could never score a very low or very high colour/
// fabric criterion, no matter how bad or good the actual match was — the
// composition-only constants dominated. The two functions below keep ONLY the
// sub-terms that are meaningful for exactly one item and drop the rest, so the
// full 0–100 range is reachable again.

// scoreSingleItemColor: base is driven purely by paletteAlignment (how
// directly the item's colour matches the user's explicit palette — 1.0 if it's
// in their chosen swatches, 0.0 if not, 0.5 neutral when they haven't picked
// explicit swatches yet). The SAME bonus magnitudes the feed's colour scorer
// uses are layered on top, unchanged: personal colour-season match/avoid
// (±0.10, seasonCompatibilityBonus), current weather season (±0.08,
// weatherSeasonColorBonus), and the 12-tone quality/avoid refinement
// (+0.08/−0.06, tone12QualityBonus/tone12AvoidPenalty). Clamped to [0, 1].
function scoreSingleItemColor(
  item: FitItem,
  colorPreferences: string[],
  colorSeason?: string,
  weatherSeason?: Season,
  colorTone12?: string,
): number {
  const profiles = [item.colorProfile];
  const userPrimaries = new Set(colorPreferences.map(name => colorProfileOf(name).primaryColor));

  let raw = paletteAlignment(profiles, userPrimaries);
  if (colorSeason) raw += seasonCompatibilityBonus(profiles, colorSeason);
  if (weatherSeason) raw += weatherSeasonColorBonus(profiles, weatherSeason);
  if (colorTone12) {
    raw += tone12QualityBonus(profiles, colorTone12);
    raw += tone12AvoidPenalty(profiles, colorTone12);
  }
  return Math.max(0, Math.min(1, raw));
}

// scoreSingleItemFabric: score is the item's own fabric-season vs. current
// weather-season match (SEASON_COMPAT — the SAME table scoreSeasonMatch uses),
// applied directly instead of blended 60/40 with a fixed 0.8 "internal
// consistency" placeholder (meaningless for one garment — there is nothing to
// be internally consistent WITH). No target season → fall back to the
// season-agnostic 'allSeason' column (don't guess a season we don't know; see
// Fix 2's provenance-gate rationale for the same "don't confidently guess"
// principle). The existing style allow/ban fabric bonus is layered on top,
// unchanged.
function scoreSingleItemFabric(
  item: FitItem,
  weatherSeason: Season | undefined,
  selectedStyles: string[],
): number {
  const itemSeason = item.fabric.season;
  const seasonRaw = weatherSeason
    ? SEASON_COMPAT[weatherSeason][itemSeason]
    : SEASON_COMPAT.allSeason[itemSeason];

  let styleBonus = 0;
  if (selectedStyles.length > 0 && item.fabricName) {
    const fn = item.fabricName;
    for (const styleId of selectedStyles) {
      const cfg = styleConfigById(styleId);
      if (!cfg) continue;
      if (cfg.fabricsBanned.includes(fn)) { styleBonus -= 0.20; break; }
      if (cfg.fabricsAllowed.length > 0 && cfg.fabricsAllowed.includes(fn)) { styleBonus += 0.10; break; }
    }
  }

  return Math.max(0, Math.min(1, seasonRaw + styleBonus));
}

// ─── Criterion-level explanations (bilingual — en/vi, keyed off request locale) ─

function colorExplanation(locale: Locale, score: number, item: FitItem, colorSeason?: string, colorTone12?: string): string {
  const color = item.colorProfile.primaryColor;
  let explanation: string;
  if (locale === 'vi') {
    if (score >= 85) explanation = `${color} hài hòa tốt với mùa màu của bạn${colorSeason ? ` (mùa ${colorSeason})` : ''} và bảng màu cá nhân.`;
    else if (score >= 70) explanation = `${color} tương thích với bảng màu của bạn, dù chưa phải lựa chọn hoàn hảo.`;
    else if (score >= 50) explanation = `${color} có mức phù hợp hạn chế với sở thích màu sắc của bạn.`;
    else explanation = `${color} xung khắc với bảng màu của bạn${colorSeason ? ` cho mùa ${colorSeason}` : ''}.`;
  } else {
    if (score >= 85) explanation = `${color} harmonizes well with your color season${colorSeason ? ` (${colorSeason})` : ''} and palette.`;
    else if (score >= 70) explanation = `${color} is compatible with your palette, though not a perfect match.`;
    else if (score >= 50) explanation = `${color} has limited alignment with your color preferences.`;
    else explanation = `${color} conflicts with your color palette${colorSeason ? ` for ${colorSeason} season` : ''}.`;
  }

  // Skip-list note: only when the tone12 refinement is present AND the item's
  // colour is actually on that tone's avoid list (TONE12_AVOID, reused from
  // the engine so the two never drift).
  if (colorTone12 && TONE12_AVOID[colorTone12]?.includes(color)) {
    explanation += locale === 'vi'
      ? ` Lưu ý: ${color} nằm trong danh sách nên tránh của bảng màu ${colorTone12.replace('_', ' ')}.`
      : ` Note: ${color} is on the skip-list for your ${colorTone12.replace('_', ' ')} palette.`;
  }
  return explanation;
}

function styleExplanation(locale: Locale, score: number, item: FitItem, selectedStyles: string[]): string {
  const styleNames = selectedStyles.slice(0, 2).join(', ');
  const type = item.typeName;
  if (locale === 'vi') {
    if (score >= 85) return `${type} hợp tự nhiên với phong cách ${styleNames} của bạn.`;
    if (score >= 70) return `${type} khá tương thích với phong cách ${styleNames} của bạn.`;
    if (score >= 50) return `${type} chỉ phù hợp một phần với phong cách ${styleNames} của bạn.`;
    return `${type} ít ăn khớp với sở thích phong cách ${styleNames} của bạn.`;
  }
  if (score >= 85) return `${type} fits naturally with your ${styleNames} aesthetic.`;
  if (score >= 70) return `${type} is broadly compatible with your ${styleNames} style.`;
  if (score >= 50) return `${type} partially overlaps with your ${styleNames} style.`;
  return `${type} has limited style coherence with your ${styleNames} preferences.`;
}

function fitExplanation(locale: Locale, score: number, itemFit: ItemFitStr, preferredFit?: PreferredFit, bodyShape?: BodyShape): string {
  if (locale === 'vi') {
    const shapePart = bodyShape ? ` cho dáng người ${bodyShape}` : '';
    if (score >= 85) return `Form ${itemFit} khớp với form bạn ưa thích (${preferredFit?.toLowerCase() ?? 'chưa rõ'})${shapePart}.`;
    if (score >= 70) return `Form ${itemFit} khá hợp với phong cách của bạn${shapePart}.`;
    if (score >= 50) return `Form ${itemFit} có thể khác với form quen thuộc của bạn (${preferredFit?.toLowerCase() ?? 'chưa rõ'})${shapePart}.`;
    return `Form ${itemFit} không hợp với form bạn ưa thích (${preferredFit?.toLowerCase() ?? 'chưa rõ'})${shapePart}.`;
  }
  const shapePart = bodyShape ? ` for a ${bodyShape} body shape` : '';
  if (score >= 85) return `${itemFit} fit matches your preferred ${preferredFit?.toLowerCase() ?? 'fit'}${shapePart}.`;
  if (score >= 70) return `${itemFit} fit is mostly compatible with your style${shapePart}.`;
  if (score >= 50) return `${itemFit} fit may feel different from your usual ${preferredFit?.toLowerCase() ?? 'preference'}${shapePart}.`;
  return `${itemFit} fit doesn't align well with your ${preferredFit?.toLowerCase() ?? 'preferred'} fit${shapePart}.`;
}

function measurementExplanation(locale: Locale, score: number, warnings: string[]): string {
  if (locale === 'vi') {
    if (warnings.length === 0 && score >= 85) return 'Số đo món đồ khớp tốt với số đo cơ thể của bạn.';
    if (warnings.length === 0 && score >= 70) return 'Số đo món đồ khá vừa vặn với cơ thể bạn.';
    if (warnings.length > 0) return `Có thể có vấn đề về độ vừa: ${warnings.slice(0, 2).join('; ')}.`;
    return 'Số đo món đồ không khớp tốt với số đo cơ thể của bạn.';
  }
  if (warnings.length === 0 && score >= 85) return 'Garment measurements align well with your body measurements.';
  if (warnings.length === 0 && score >= 70) return 'Garment measurements are a good fit for your body.';
  if (warnings.length > 0) return `Potential fit concerns: ${warnings.slice(0, 2).join('; ')}.`;
  return 'Garment measurements do not align well with your body measurements.';
}

function fabricExplanation(locale: Locale, score: number, item: FitItem, _selectedStyles: string[]): string {
  const fabricName = item.fabricName ?? item.fabric.fabricWeight + '-weight fabric';
  const season = item.fabric.season;
  if (locale === 'vi') {
    if (score >= 85) return `${fabricName} phù hợp mùa (${season}) và hợp phong cách của bạn.`;
    if (score >= 70) return `${fabricName} phù hợp cho mùa ${season} và hợp phong cách.`;
    if (score >= 50) return `${fabricName} dùng được nhưng chưa lý tưởng cho phong cách hoặc mùa hiện tại.`;
    return `${fabricName} có thể không hợp phong cách bạn ưa thích hoặc mùa hiện tại.`;
  }
  if (score >= 85) return `${fabricName} is season-appropriate (${season}) and suits your style.`;
  if (score >= 70) return `${fabricName} works for ${season} and is style-compatible.`;
  if (score >= 50) return `${fabricName} is usable but not ideal for your typical style or season.`;
  return `${fabricName} may not suit your preferred styles or the current season.`;
}

// ─── Unavailability explanation helpers ──────────────────────────────────────

function unavailableExplanation(locale: Locale, key: CriterionKey, missingItem: boolean, missingProfile: boolean): string {
  if (missingItem && missingProfile) {
    const joiner = locale === 'vi' ? ' Ngoài ra, ' : ' Also, ';
    return unavailableItemExplanation(locale, key) + joiner + unavailableProfileExplanation(locale, key).toLowerCase();
  }
  if (missingItem) return unavailableItemExplanation(locale, key);
  return unavailableProfileExplanation(locale, key);
}

function unavailableItemExplanation(locale: Locale, key: CriterionKey): string {
  if (locale === 'vi') {
    switch (key) {
      case 'color':       return 'Thiếu màu sản phẩm — quét hoặc nhập màu để chấm điểm mục này.';
      case 'style':       return 'Thiếu loại trang phục — nhập loại trang phục để chấm điểm mục này.';
      case 'fit':         return 'Thiếu thông tin form dáng — thêm nhãn form (slim/regular/relaxed/oversized) để chấm điểm mục này.';
      case 'measurement': return 'Món đồ chưa có số đo — thêm số đo trang phục để chấm điểm mục này.';
      case 'fabric':      return 'Thiếu chất liệu — thêm tên vải/chất liệu để chấm điểm mục này.';
    }
  }
  switch (key) {
    case 'color':       return 'Item color is missing — scan or enter the color to score this.';
    case 'style':       return 'Item type is missing — provide the garment type to score this.';
    case 'fit':         return 'Item fit is missing — add a fit label (slim/regular/relaxed/oversized) to score this.';
    case 'measurement': return 'Item has no numeric measurements — add garment measurements to score this.';
    case 'fabric':      return 'Item material is missing — add a fabric/material name to score this.';
  }
}

// 4 suggestion toggles (2026-08-10): explanation shown when the user turned a
// dimension off in Settings — deliberately distinct from
// unavailable*Explanation above, which implies missing DATA (add a style
// preference / body measurement). A toggled-off criterion may have full data
// behind it; the copy must not tell the user to go add something they already
// have.
function toggledOffExplanation(locale: Locale, key: 'style' | 'measurement'): string {
  if (locale === 'vi') {
    return key === 'style'
      ? 'Chấm điểm theo phong cách đang tắt trong Cài đặt gợi ý.'
      : 'Chấm điểm theo số đo cơ thể đang tắt trong Cài đặt gợi ý.';
  }
  return key === 'style'
    ? 'Style-based scoring is turned off in your suggestion settings.'
    : 'Measurement-based scoring is turned off in your suggestion settings.';
}

function unavailableProfileExplanation(locale: Locale, key: CriterionKey): string {
  if (locale === 'vi') {
    switch (key) {
      case 'color':       return 'Hoàn thiện hồ sơ màu sắc của bạn (mùa màu hoặc bảng màu cá nhân) để chấm điểm màu.';
      case 'style':       return 'Chọn ít nhất một phong cách yêu thích trong hồ sơ để chấm điểm độ hợp phong cách.';
      case 'fit':         return 'Thêm form dáng ưa thích hoặc dáng người trong hồ sơ để chấm điểm form.';
      case 'measurement': return 'Thêm số đo cơ thể trong hồ sơ để chấm điểm độ vừa vặn trang phục.';
      case 'fabric':      return 'Sở thích phong cách giúp chấm điểm chất liệu chính xác hơn — cân nhắc thêm vào hồ sơ.';
    }
  }
  switch (key) {
    case 'color':       return 'Complete your color profile (color season or personal palette) for color scoring.';
    case 'style':       return 'Set at least one style preference in your profile to score style compatibility.';
    case 'fit':         return 'Add your preferred fit or body shape in your profile to score fit.';
    case 'measurement': return 'Add your body measurements in your profile to score garment fit.';
    case 'fabric':      return 'Style preferences help contextualise fabric scoring — consider adding them.';
  }
}

// ─── Per-criterion scorers ────────────────────────────────────────────────────

interface ProfileInputs {
  colorPreferences: string[];
  colorSeason: string | undefined;
  colorTone12?: string;     // 12-tone refinement of colorSeason (e.g. 'deep_autumn')
  selectedStyles: string[];
  bodyMeasurements: BodyMeasurements;
  weatherSeason?: Season;   // current real-world season (date + hemisphere)
  gender?: string;          // 'WOMAN' | 'MAN' | … — only used to shape the coarse
                            // height/weight girth estimate; scoring is otherwise gender-blind.
  locale?: Locale;          // drives explanation language (default 'en'); see note.ts
  // 4 suggestion toggles (2026-08-10), mirroring generate-outfits' EngineContext
  // flags. undefined/true = on (default, unchanged behavior). false forces the
  // matching criterion to `available: false` below — same "drops out, weight
  // renormalizes" mechanism computeVerdict already uses for missing data.
  // NOTE: 'fit' (body_shape + preferredFit) is intentionally NOT gated by
  // suggestByMeasurements — only 'measurement' (the numeric garment-vs-body
  // comparison, the direct analog of the feed's fitScore) is. Suppressing
  // body_shape is bodyNeutralMode's job, not this toggle's — see index.ts.
  suggestByStyle?: boolean;
  suggestByMeasurements?: boolean;
}

// ─── Coarse body-girth estimate (low-confidence fallback) ─────────────────────
// Lets a freshly-onboarded user who only entered height + weight still get a fit
// read, instead of an all-unavailable dead end. Derivation: body volume ≈ weight
// (density ≈ 1 kg/L); modelling the torso as a cylinder of the given height gives
// an average circumference ≈ k·√(weight/height). We split that average into
// bust/waist/hip with gender-typical ratios. The result is anthropometrically
// plausible and monotonic in height & weight, but is NOT a real measurement — so
// the measurement criterion flags it as "estimated" and is down-weighted
// (ESTIMATED_MEASUREMENT_WEIGHT) so it never dominates the verdict. See backlog #4.
const GIRTH_K = 143;
const ESTIMATED_MEASUREMENT_WEIGHT = 0.10;

const GIRTH_RATIOS: Record<'woman' | 'man' | 'neutral', { bust: number; waist: number; hip: number }> = {
  woman:   { bust: 1.04, waist: 0.83, hip: 1.13 },
  man:     { bust: 1.05, waist: 0.90, hip: 1.05 },
  neutral: { bust: 1.05, waist: 0.87, hip: 1.09 },
};

function estimateGirths(heightCm: number, weightKg: number, gender?: string):
  Pick<BodyMeasurements, 'body_bust' | 'body_waist' | 'body_hip'> {
  const g = gender === 'WOMAN' ? 'woman' : gender === 'MAN' ? 'man' : 'neutral';
  const r = GIRTH_RATIOS[g];
  const avg = GIRTH_K * Math.sqrt(weightKg / heightCm);
  return {
    body_bust:  Math.round(avg * r.bust),
    body_waist: Math.round(avg * r.waist),
    body_hip:   Math.round(avg * r.hip),
  };
}

function scoreColor(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'color';
  const weight = DEFAULT_WEIGHTS[key];
  const locale: Locale = profile.locale ?? 'en';

  const missingItem    = !item.colorProfile || item.colorProfile.primaryColor === 'natural' && typeof item.colorProfile.hue !== 'number';
  const missingProfile = profile.colorPreferences.length === 0 && !profile.colorSeason;

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(locale, key, missingItem, missingProfile),
    };
  }

  // Single-item colour scorer (Fix 1, 2026-08-06) — see the doc comment above
  // scoreSingleItemColor for why the outfit-level scoreColorHarmony can't be
  // reused for one item. weatherSeason adds the same seasonal-colour nudge the
  // feed uses (summer→light/bright, winter→dark); personal colourSeason stays
  // primary. colorTone12 layers the 12-tone quality bonus (light/deep/bright/
  // soft) on top, same as the feed.
  const raw = scoreSingleItemColor(item, profile.colorPreferences, profile.colorSeason, profile.weatherSeason, profile.colorTone12);
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return { key, available: true, score, weight, explanation: colorExplanation(locale, score, item, profile.colorSeason, profile.colorTone12) };
}

function scoreStyle(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'style';
  const weight = DEFAULT_WEIGHTS[key];
  const locale: Locale = profile.locale ?? 'en';

  if (profile.suggestByStyle === false) {
    return { key, available: false, score: null, weight, explanation: toggledOffExplanation(locale, key) };
  }

  const missingItem    = !item.typeName;
  const missingProfile = profile.selectedStyles.length === 0;

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(locale, key, missingItem, missingProfile),
    };
  }

  const userAttributes = computeUserAttributes(profile.selectedStyles);
  if (!userAttributes) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableProfileExplanation(locale, key),
    };
  }

  const raw = scoreStyleCoherence([item], userAttributes, profile.selectedStyles);
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return { key, available: true, score, weight, explanation: styleExplanation(locale, score, item, profile.selectedStyles) };
}

function scoreFit(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'fit';
  const weight = DEFAULT_WEIGHTS[key];
  const locale: Locale = profile.locale ?? 'en';

  const preferredFit = profile.bodyMeasurements.preferredFit;
  const bodyShape    = profile.bodyMeasurements.body_shape;

  // item.fit is always derived (never null) by toFitItem — so no missing item attr.
  // But the FitItem might come from a minimal item object; treat missing typeName as indicator.
  // Fix 2 (provenance gate, 2026-08-06): toFitItem marks item.provenance.fit
  // false when it had to DEFAULT the fit (no `fit` field in the request and no
  // fit keyword in the garment name) — e.g. an unlabelled HOODIE silently
  // defaults to 'oversized'. Scoring that guess with full confidence produced
  // wrong, confident verdicts (a slim-preferring user seeing a 10/100 on a
  // fit the item was never actually confirmed to have). When the fit is a
  // guess, treat the criterion as unavailable — same "don't confidently guess"
  // treatment the feed already applies via provenance.fit (ranking.ts).
  const missingItem    = !item.typeName || !item.provenance.fit;
  // Fit criterion requires at least preferredFit OR body_shape in the profile.
  const missingProfile = !preferredFit && !bodyShape;

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(locale, key, missingItem, missingProfile),
    };
  }

  let raw = 0.5;

  // Fit-preference sub-score (0–1)
  if (preferredFit) {
    raw = scoreFitPreference(item.fit, preferredFit);
  }

  // Body-shape sub-score: engine's shape rules, scaled by how body-specific the
  // item's fit is (bodyShapeAdjustment returns an additive delta in ±0.32 —
  // fitted items feel the full adjustment, oversized/loose barely any; see
  // docs/research/body-shape-importance-FINAL.md).
  if (bodyShape) {
    const delta = bodyShapeAdjustment([item], bodyShape);
    raw = Math.max(0, Math.min(1.0, raw + delta));
    // If we had no preferredFit, center the stand-alone score on neutral 0.5.
    if (!preferredFit) raw = Math.max(0, Math.min(1.0, 0.5 + delta));
  }

  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return {
    key, available: true, score, weight,
    explanation: fitExplanation(locale, score, item.fit, preferredFit, bodyShape),
  };
}

function scoreMeasurement(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'measurement';
  const weight = DEFAULT_WEIGHTS[key];
  const locale: Locale = profile.locale ?? 'en';

  if (profile.suggestByMeasurements === false) {
    return { key, available: false, score: null, weight, explanation: toggledOffExplanation(locale, key) };
  }

  const missingItem    = !item.garmentMeasurements || Object.keys(item.garmentMeasurements).length === 0;

  // Without any garment measurements there is nothing to compare against — no
  // estimate can rescue this; the item itself lacks the data.
  if (missingItem) {
    const hasAnyBody = !!profile.bodyMeasurements.body_bust || !!profile.bodyMeasurements.body_waist;
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(locale, key, true, !hasAnyBody),
    };
  }

  // Check if the user has any relevant numeric body measurements (not just preferredFit/bodyShape).
  const BODY_NUM_KEYS: Array<keyof BodyMeasurements> = [
    'body_bust', 'body_waist', 'body_hip', 'body_shoulder_width',
    'body_sleeve_length', 'body_upper_body_length', 'body_upper_arm',
    'body_inseam', 'body_thigh', 'body_rise',
  ];
  const hasBodyMeasurements = BODY_NUM_KEYS.some(k => typeof profile.bodyMeasurements[k] === 'number');

  // Resolve the body to score against. Prefer the user's real detailed measurements;
  // otherwise fall back to a coarse estimate from height + weight (low confidence) so
  // a freshly-onboarded user still gets a fit read instead of a dead end.
  let body = profile.bodyMeasurements;
  let estimated = false;
  if (!hasBodyMeasurements) {
    const h = profile.bodyMeasurements.body_height;
    const w = profile.bodyMeasurements.body_weight;
    if (typeof h === 'number' && h > 0 && typeof w === 'number' && w > 0) {
      body = { ...profile.bodyMeasurements, ...estimateGirths(h, w, profile.gender) };
      estimated = true;
    } else {
      // No detailed measurements and no height/weight to estimate from → unavailable.
      return {
        key, available: false, score: null, weight,
        explanation: unavailableProfileExplanation(locale, key),
      };
    }
  }

  // Reuse the per-item fit result from the engine.
  const result = scoreItemFit(item, body);

  // If scoreItemFit returned no points (no overlap between garment/body keys),
  // it returns score=0.5 and no points — treat as unavailable rather than a neutral score.
  if (result.points.length === 0) {
    return {
      key, available: false, score: null, weight,
      explanation: locale === 'vi'
        ? 'Không có cặp số đo nào để so sánh — hãy thêm số đo cơ thể liên quan.'
        : 'No matching measurement pairs could be compared — add relevant body measurements.',
    };
  }

  const score = Math.round(Math.min(100, Math.max(0, result.score * 100)));

  // Estimated mode: down-weight so it never dominates the verdict, relabel as
  // approximate, and suppress the per-measurement "tight" warnings — they'd imply a
  // precision we don't have from height/weight alone.
  if (estimated) {
    return {
      key, available: true, score, weight: ESTIMATED_MEASUREMENT_WEIGHT,
      explanation: locale === 'vi'
        ? 'Ước tính từ chiều cao và cân nặng — chỉ mang tính tương đối. Thêm số đo cơ thể chi tiết để có kết quả chính xác hơn.'
        : 'Estimated from your height and weight — approximate. Add detailed body measurements for an exact fit read.',
    };
  }

  return {
    key, available: true, score, weight,
    explanation: measurementExplanation(locale, score, result.warnings),
  };
}

function scoreFabric(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'fabric';
  const weight = DEFAULT_WEIGHTS[key];
  const locale: Locale = profile.locale ?? 'en';

  const missingItem    = !item.fabricName;
  // Fabric benefits from style context, but is evaluable without a profile if material is present.
  // Per R3: fabric criterion requires item material — profile is optional for this criterion.
  const missingProfile = false; // fabric is always evaluable if item.material present

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(locale, key, missingItem, missingProfile),
    };
  }

  // Single-item fabric scorer (Fix 1, 2026-08-06) — see the doc comment above
  // scoreSingleItemFabric for why the outfit-level scoreSeasonMatch's fixed
  // 0.8 "internal consistency" term made sense for outfits but floored/capped
  // a single item's fabric score at [32, 92] regardless of how badly the
  // fabric actually suited the current season (a wool coat in summer never
  // scored below 32).
  const raw = scoreSingleItemFabric(item, profile.weatherSeason, profile.selectedStyles);
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return {
    key, available: true, score, weight,
    explanation: fabricExplanation(locale, score, item, profile.selectedStyles),
  };
}

// ─── Composite score with weight renormalization ──────────────────────────────

export function computeVerdict(item: FitItem, profile: ProfileInputs): VerdictResult {
  const criteria: CriterionScore[] = [
    scoreColor(item, profile),
    scoreStyle(item, profile),
    scoreFit(item, profile),
    scoreMeasurement(item, profile),
    scoreFabric(item, profile),
  ];

  // Filter to available criteria and renormalize weights.
  const available = criteria.filter(c => c.available && c.score !== null);

  if (available.length === 0) {
    return { overall_score: null, recommendation: null, criteria };
  }

  const weightSum = available.reduce((s, c) => s + c.weight, 0);
  let weightedScore = 0;
  for (const c of available) {
    weightedScore += (c.score! * c.weight) / weightSum;
  }

  const overall_score = Math.round(Math.min(100, Math.max(0, weightedScore)));
  const recommendation = toRecommendation(overall_score);

  return { overall_score, recommendation, criteria };
}
