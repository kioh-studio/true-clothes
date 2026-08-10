// Wardrobe Critic core logic (feature 010) — pure, deterministic, no I/O.
// Simulates the DAILY FEED's own pipeline (enrich → style filter → generate →
// rank → quality gate) with hypothetical archetype items injected, so every
// unlock count is a real promise measured by the same bar the feed uses (SC-002).

import {
  ClothingItemRow, FitItem, BodyMeasurements, EngineContext, Season, ScoredOutfit,
} from '../generate-outfits/engine/types.ts';
import { toFitItem, colorProfileOf } from '../generate-outfits/engine/enrichment.ts';
import { filterByStyle, styleConfigById } from '../generate-outfits/engine/filtering.ts';
import { generateCandidates, generateHeroCandidates, getColorFamily, GENERATION_CAP } from '../generate-outfits/engine/generation.ts';
import { rankCandidates } from '../generate-outfits/engine/ranking.ts';
import { ARCHETYPES, GapArchetype } from './archetypes.ts';

// Same quality bar as generate-outfits/index.ts — an outfit "counts" here iff
// it would count on the feed.
const MIN_QUALITY = 0.50;
const QUALITY_BAND = 0.18;

export const UNLOCK_THRESHOLD = 3;   // FR-001
export const MAX_RECOMMENDATIONS = 3;
export const SPARSE_MIN_ITEMS = 10;  // FR-008
export const REDUNDANCY_MIN = 5;     // US3

export interface AnalyzeInput {
  wardrobeRows: ClothingItemRow[];
  selectedStyles: string[];
  colorPreferences: string[];
  bodyMeasurements: BodyMeasurements;
  colorSeason?: string;
  colorTone12?: string;
  weatherSeason?: Season;
  seed: string;
  // 4 suggestion toggles (2026-08-10) — threaded straight into the shared
  // EngineContext below, same undefined/true = on convention as
  // generate-outfits. suggest_by_formula has no equivalent here:
  // qualifiedOutfits always calls generateCandidates(items, undefined, seed) —
  // formula preference was never read in this pipeline, so that toggle is a
  // structural no-op for wardrobe-critic.
  suggestByStyle?: boolean;
  suggestByMeasurements?: boolean;
}

export interface Recommendation {
  archetypeId: string;
  label: { en: string; vi: string };
  unlockCount: number;
  note: { en: string; vi: string };
  sampleOutfits: string[][];
}

export interface Redundancy {
  typeName: string;
  colorFamily: string;
  count: number;
  note: { en: string; vi: string };
}

export interface GapReport {
  mode: 'gaps' | 'starter' | 'complete';
  baselineQualified: number;
  recommendations: Recommendation[];
  starterChecklist: Array<{ archetypeId: string; label: { en: string; vi: string }; owned: boolean }>;
  redundancy: Redundancy | null;
}

// ─── Shared feed-pipeline pieces ─────────────────────────────────────────────

function applyQualityGate(ranked: ScoredOutfit[]): ScoredOutfit[] {
  if (ranked.length === 0) return ranked;
  const best = ranked.reduce((m, o) => Math.max(m, o.totalScore), 0);
  const cut = Math.max(MIN_QUALITY, best - QUALITY_BAND);
  return ranked.filter(o => o.totalScore >= cut);
}

export function styleFilter(fitItems: FitItem[], selectedStyles: string[]): FitItem[] {
  const configs = selectedStyles
    .map(id => styleConfigById(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  if (configs.length === 0) return fitItems;
  const passed = new Set<string>();
  for (const config of configs) {
    for (const item of filterByStyle(fitItems, config).passed) passed.add(item.id);
  }
  return fitItems.filter(i => passed.has(i.id));
}

// Run the feed pipeline on an item set and return the QUALIFIED outfits.
function qualifiedOutfits(items: FitItem[], ctx: EngineContext, seed: string): ScoredOutfit[] {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const userPalette = ctx.colorPreferences.map(c => colorProfileOf(c).primaryColor);
  const heroCandidates = generateHeroCandidates(items, seed, userPalette);
  const candidates = [...heroCandidates, ...generateCandidates(items, undefined, seed)]
    .slice(0, GENERATION_CAP);
  return applyQualityGate(rankCandidates(candidates, itemMap, ctx));
}

const slotIds = (o: ScoredOutfit): string[] =>
  [...new Set([o.slots.top, o.slots.bottom, o.slots.shoes, o.slots.outwear, o.slots.accessory]
    .filter((id): id is string => id !== undefined))];

// ─── Owned / affinity checks ─────────────────────────────────────────────────

function ownsArchetype(items: FitItem[], a: GapArchetype): boolean {
  return items.some(i =>
    i.typeName === a.ownedMatch.type &&
    getColorFamily(i.colorProfile.primaryColor) === a.ownedMatch.colorFamily);
}

function styleEligible(a: GapArchetype, selectedStyles: string[]): boolean {
  if (selectedStyles.length === 0) return true;
  return a.styleAffinity.some(s => selectedStyles.includes(s));
}

export function matchArchetype(item: FitItem): GapArchetype | null {
  return ARCHETYPES.find(a =>
    a.ownedMatch.type === item.typeName &&
    a.ownedMatch.colorFamily === getColorFamily(item.colorProfile.primaryColor)) ?? null;
}

// ─── Unlock simulation for one candidate item (archetype OR scanned item) ────

export function unlockCountFor(
  baseItems: FitItem[], candidate: FitItem, ctx: EngineContext, seed: string,
): { count: number; samples: string[][] } {
  const withCandidate = [...baseItems, candidate];
  const qualified = qualifiedOutfits(withCandidate, ctx, seed);
  const containing = qualified.filter(o => slotIds(o).includes(candidate.id));
  const samples = containing.slice(0, 3).map(o => slotIds(o).filter(id => id !== candidate.id));
  return { count: containing.length, samples };
}

// ─── Redundancy (US3) ────────────────────────────────────────────────────────

function findRedundancy(items: FitItem[]): Redundancy | null {
  const clusters = new Map<string, { typeName: string; colorFamily: string; count: number }>();
  for (const i of items) {
    const family = getColorFamily(i.colorProfile.primaryColor);
    const register = Math.round(i.formality); // coarse register band
    const key = `${i.typeName}|${family}|${register}`;
    const c = clusters.get(key) ?? { typeName: i.typeName, colorFamily: family, count: 0 };
    c.count++;
    clusters.set(key, c);
  }
  const biggest = [...clusters.values()].sort((a, b) => b.count - a.count)[0];
  if (!biggest || biggest.count < REDUNDANCY_MIN) return null;
  const pretty = biggest.typeName.charAt(0) + biggest.typeName.slice(1).toLowerCase();
  return {
    ...biggest,
    note: {
      en: `You already own ${biggest.count} similar ${pretty.toLowerCase()}s — the next one won't open a single new look.`,
      vi: `Anh đã có ${biggest.count} chiếc ${pretty.toLowerCase()} gần giống nhau — chiếc tiếp theo sẽ không mở thêm look nào.`,
    },
  };
}

// ─── Main analysis ───────────────────────────────────────────────────────────

export function analyzeWardrobe(input: AnalyzeInput): GapReport {
  const fitItems = input.wardrobeRows.map(toFitItem);
  const filtered = styleFilter(fitItems, input.selectedStyles);

  const ctx: EngineContext = {
    bodyMeasurements: input.bodyMeasurements,
    styleProfile: { selectedStyles: input.selectedStyles },
    colorPreferences: input.colorPreferences,
    colorSeason: input.colorSeason,
    colorTone12: input.colorTone12,
    weatherSeason: input.weatherSeason,
    suggestByStyle: input.suggestByStyle,
    suggestByMeasurements: input.suggestByMeasurements,
  };

  const hasCore = (cat: string) => filtered.some(i => i.category === cat);
  const sparse = filtered.length < SPARSE_MIN_ITEMS || !hasCore('top') || !hasCore('bottom') || !hasCore('shoes');

  const redundancy = findRedundancy(fitItems);

  if (sparse) {
    const checklist = ARCHETYPES
      .filter(a => a.starter && styleEligible(a, input.selectedStyles))
      .map(a => ({ archetypeId: a.id, label: a.label, owned: ownsArchetype(fitItems, a) }));
    return { mode: 'starter', baselineQualified: 0, recommendations: [], starterChecklist: checklist, redundancy };
  }

  const baseline = qualifiedOutfits(filtered, ctx, input.seed);

  const scoredArchetypes: Recommendation[] = [];
  for (const a of ARCHETYPES) {
    if (!styleEligible(a, input.selectedStyles)) continue;
    if (ownsArchetype(fitItems, a)) continue;
    const hypo = toFitItem(a.syntheticRow);
    const { count, samples } = unlockCountFor(filtered, hypo, ctx, input.seed);
    if (count < UNLOCK_THRESHOLD) continue;
    scoredArchetypes.push({
      archetypeId: a.id,
      label: a.label,
      unlockCount: count,
      note: {
        en: a.noteTemplate.en.replace('{count}', String(count)),
        vi: a.noteTemplate.vi.replace('{count}', String(count)),
      },
      sampleOutfits: samples,
    });
  }

  scoredArchetypes.sort((x, y) => y.unlockCount - x.unlockCount || (x.archetypeId < y.archetypeId ? -1 : 1));
  const recommendations = scoredArchetypes.slice(0, MAX_RECOMMENDATIONS);

  return {
    mode: recommendations.length > 0 ? 'gaps' : 'complete',
    baselineQualified: baseline.length,
    recommendations,
    starterChecklist: [],
    redundancy,
  };
}
