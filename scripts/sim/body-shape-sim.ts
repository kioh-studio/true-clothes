// body-shape-sim.ts — OFFLINE simulation harness (no DB, no network, no engine
// mutation). Answers two questions:
//   1) Does the fit engine actually DERIVE a body shape from raw measurements?
//   2) Does that derived shape actually CHANGE outfit scoring/ranking outcomes,
//      or is it cosmetic (a tag with no downstream effect)?
//
// Run:  deno run --allow-read scripts/sim/body-shape-sim.ts
//   or: npm run body-shape-sim
//
// Prints 4 sections (A: classifier correctness, B: degeneracy/coverage sweep,
// C: outfit-outcome effect, D: machine-checkable verdict) as plain ASCII
// tables to stdout. Deterministic — a seeded PRNG (mulberry32), never
// Math.random.

import {
  computeBodyShape,
  BodyShape as ClientBodyShape,
} from '../../src/types/measurements.ts';

import {
  scoreOutfitFit, scoreItemFit, bodyShapeMultiplier, bodyShapeAdjustment, VOLUME,
  preferredFitDelta,
} from '../../supabase/functions/generate-outfits/engine/scoring.ts';

import {
  resolveTargetSilhouette, resultingBodySilhouette, pairSilhouetteMatch,
} from '../../supabase/functions/generate-outfits/engine/silhouette.ts';

import {
  FitItem,
  BodyMeasurements as EngineBodyMeasurements,
  ItemCategory,
  GarmentMeasurements,
  EngineContext,
  BodyShape as EngineBodyShape,
  PreferredFit,
} from '../../supabase/functions/generate-outfits/engine/types.ts';

// ═══════════════════════════════════════════════════════════════════════════
// NAMING-GAP BRIDGE
// ═══════════════════════════════════════════════════════════════════════════
// The CLIENT type (src/types/measurements.ts) stores the derived shape under
// `bodyShape` (camelCase). The ENGINE type (engine/types.ts) expects it under
// `body_shape` (snake_case) — same string union values, different key. The
// real app bridges this in src/services/measurementService.ts: line 49 reads
// `row.body_shape` into `bodyShape` on load, line 72 writes `m.bodyShape` back
// into `row.body_shape` on save. Nothing computes body_shape on the engine
// side — it is only ever produced by the client's computeBodyShape() and
// carried across this camelCase <-> snake_case rename.
function bridgeClientShapeToEngine(shape: ClientBodyShape | null): EngineBodyShape | undefined {
  return shape ?? undefined;
}

console.log('BRIDGE NOTE: client BodyMeasurements.bodyShape (camelCase) is renamed to');
console.log('engine BodyMeasurements.body_shape (snake_case) — same values, different key.');
console.log('Real app does this in measurementService.ts:49 (read) / :72 (write).');
console.log('This script reproduces that rename via bridgeClientShapeToEngine().\n');

// ═══════════════════════════════════════════════════════════════════════════
// PRNG — mulberry32 (seeded, deterministic, NOT Math.random)
// ═══════════════════════════════════════════════════════════════════════════
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINT HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function padR(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}
function padL(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : ' '.repeat(w - s.length) + s;
}
function num(n: number | undefined, decimals = 1): string {
  return n === undefined ? 'n/a' : n.toFixed(decimals);
}
function rule(w: number): string {
  return '-'.repeat(w);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION A — Classifier correctness
// ═══════════════════════════════════════════════════════════════════════════

interface Archetype {
  name: string;
  bust?: number;
  waist?: number;
  hip?: number;
  expected: ClientBodyShape | null;
  note?: string;
}

// Expected labels are MY judgment from standard body-shape convention, NOT
// reverse-engineered from the code. Where the code's literal threshold
// (>=, >, <=) disagrees with the convention I'd apply by eye, I report the
// mismatch rather than "fixing" the expectation — that disagreement is the
// point of this section. See inline notes on the three deliberate boundary
// rows (10, 12) plus the judgment call on row 6.
const ARCHETYPES: Archetype[] = [
  { name: 'female_hourglass',        bust: 90, waist: 66, hip: 92,  expected: 'hourglass' },
  { name: 'female_pear_triangle',    bust: 86, waist: 70, hip: 100, expected: 'triangle' },
  { name: 'female_apple',            bust: 96, waist: 88, hip: 96,  expected: 'apple' },
  { name: 'female_rectangle',        bust: 88, waist: 74, hip: 90,  expected: 'rectangle' },
  { name: 'female_inverted_triangle',bust: 98, waist: 76, hip: 88,  expected: 'inverted_triangle' },
  {
    name: 'male_average', bust: 100, waist: 88, hip: 98, expected: 'rectangle',
    note: 'WHR=0.898, bust≈hip (straight column), waist only ~12% under bust/hip — ' +
          'a mildly-undefined waist, not a visibly protruding belly. Judged rectangle ' +
          'by convention; the apple rule only requires W>=0.85B AND W>=0.85H (no B/H ' +
          'comparison), so it fires here too.',
  },
  { name: 'male_athletic_v',   bust: 104, waist: 82,  hip: 96,  expected: 'inverted_triangle' },
  { name: 'male_dadbod',       bust: 104, waist: 100, hip: 102, expected: 'apple' },
  { name: 'slim_male',         bust: 92,  waist: 78,  hip: 94,  expected: 'rectangle',
    note: 'Near-miss on the apple threshold: W=78 vs 0.85*B=78.2 (0.2cm under).' },
  { name: 'petite_hourglass',  bust: 82,  waist: 58,  hip: 84,  expected: 'hourglass' },
  {
    name: 'BOUNDARY_hip_eq_bust_plus5', bust: 90, waist: 70, hip: 95, expected: 'triangle',
    note: 'H = B+5 exactly. Common convention ("hip >=5cm bigger = pear") is INCLUSIVE; ' +
          'the code requires strict H > B+5, so exactly-5cm-bigger hips do NOT trigger triangle.',
  },
  {
    name: 'BOUNDARY_waist_eq_0.85bust', bust: 100, waist: 85, hip: 100, expected: 'rectangle',
    note: 'W = 0.85*B exactly. Judged: a waist only just touching the 85% line reads as ' +
          'still fairly proportionate, not yet "apple". The code\'s rule is INCLUSIVE (>=), ' +
          'so it classifies apple right at the threshold.',
  },
  {
    name: 'BOUNDARY_waist_eq_0.75bust', bust: 100, waist: 75, hip: 100, expected: 'hourglass',
    note: 'W = 0.75*B exactly. Convention treats <=75% as the (inclusive) hourglass cutoff; ' +
          'the code also uses <=, so this one agrees.',
  },
  { name: 'MISSING_waist', bust: 90, hip: 95, expected: null,
    note: 'body_waist absent — must yield null regardless of bust/hip.' },
];

function toClientMeasurements(a: Archetype): { body_bust?: number; body_waist?: number; body_hip?: number } {
  const m: { body_bust?: number; body_waist?: number; body_hip?: number } = {};
  if (a.bust !== undefined) m.body_bust = a.bust;
  if (a.waist !== undefined) m.body_waist = a.waist;
  if (a.hip !== undefined) m.body_hip = a.hip;
  return m;
}

console.log('═'.repeat(96));
console.log('SECTION A — Classifier correctness (computeBodyShape, src/types/measurements.ts)');
console.log('═'.repeat(96));
{
  const header = `${padR('name', 26)} ${padL('B', 6)} ${padL('W', 6)} ${padL('H', 6)} ${padL('WHR', 6)} ${padR('derived', 18)} ${padR('expected', 18)} match`;
  console.log(header);
  console.log(rule(header.length));
  let pass = 0;
  for (const a of ARCHETYPES) {
    const derived = computeBodyShape(toClientMeasurements(a));
    const ok = derived === a.expected;
    if (ok) pass++;
    const whr = a.waist !== undefined && a.hip !== undefined ? (a.waist / a.hip).toFixed(3) : 'n/a';
    console.log(
      `${padR(a.name, 26)} ${padL(num(a.bust, 0), 6)} ${padL(num(a.waist, 0), 6)} ${padL(num(a.hip, 0), 6)} ` +
      `${padL(whr, 6)} ${padR(String(derived), 18)} ${padR(String(a.expected), 18)} ${ok ? '✓' : '✗'}`,
    );
    if (a.note) console.log(`   note: ${a.note}`);
  }
  console.log(rule(header.length));
  console.log(`PASS: ${pass}/${ARCHETYPES.length}\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION B — Degeneracy / coverage sweep
// ═══════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(96));
console.log('SECTION B — Degeneracy / coverage sweep (3000 seeded-random plausible bodies)');
console.log('═'.repeat(96));

const SWEEP_SEED = 42;
const SWEEP_TARGET = 3000;
const rngSweep = mulberry32(SWEEP_SEED);

type ShapeOrNull = ClientBodyShape | null;
const SHAPE_LABELS: ShapeOrNull[] = ['hourglass', 'rectangle', 'triangle', 'inverted_triangle', 'apple', null];

const sweepCounts = new Map<string, number>();
for (const s of SHAPE_LABELS) sweepCounts.set(String(s), 0);

let attempts = 0;
let accepted = 0;
while (accepted < SWEEP_TARGET) {
  attempts++;
  const bust = randRange(rngSweep, 78, 120);
  const waist = randRange(rngSweep, 60, 110);
  const hip = randRange(rngSweep, 80, 120);
  // Plausibility: reject waist that is simultaneously >15cm bigger than BOTH
  // bust and hip (anatomically absurd — no torso reads that shape).
  if (waist > bust + 15 && waist > hip + 15) continue;
  accepted++;
  const shape = computeBodyShape({ body_bust: bust, body_waist: waist, body_hip: hip });
  sweepCounts.set(String(shape), (sweepCounts.get(String(shape)) ?? 0) + 1);
}

console.log(`Sampled: ${accepted} plausible bodies (${attempts - accepted} rejected as implausible, ${attempts} raw draws), seed=${SWEEP_SEED}`);
{
  const header = `${padR('shape', 20)} ${padL('count', 8)} ${padL('%', 8)}`;
  console.log(header);
  console.log(rule(header.length));
  let maxShare = 0;
  let maxLabel = '';
  const order: ShapeOrNull[] = ['apple', 'rectangle', 'triangle', 'inverted_triangle', 'hourglass', null];
  for (const s of order) {
    const c = sweepCounts.get(String(s)) ?? 0;
    const pct = (100 * c) / accepted;
    if (pct > maxShare) { maxShare = pct; maxLabel = String(s); }
    console.log(`${padR(String(s), 20)} ${padL(String(c), 8)} ${padL(pct.toFixed(1), 8)}`);
  }
  console.log(rule(header.length));
  console.log(`Dominant label: ${maxLabel} at ${maxShare.toFixed(1)}% share.`);
  console.log('(null share is 0% by construction — this sweep always supplies all 3 required fields;');
  console.log(' null is only reachable via a missing measurement, tested directly in Section A.)\n');
}

// Sensitivity: for the 5 canonical one-per-shape bodies, how many cm of waist
// change (in each direction) flips the label?
console.log('Sensitivity — cm of waist change (each direction) needed to flip the label:');
{
  const canonical = ARCHETYPES.slice(0, 5); // the 5 female archetypes, one per shape
  const header = `${padR('body', 26)} ${padR('baseline', 14)} ${padL('-waist flips at', 18)} ${padL('+waist flips at', 18)}`;
  console.log(header);
  console.log(rule(header.length));
  const MAX_SEARCH = 60;
  for (const a of canonical) {
    const baseline = computeBodyShape(toClientMeasurements(a));
    let downFlip: number | undefined;
    let upFlip: number | undefined;
    for (let d = 1; d <= MAX_SEARCH; d++) {
      if (downFlip === undefined && a.waist !== undefined && a.waist - d > 0) {
        const s = computeBodyShape({ body_bust: a.bust, body_waist: a.waist - d, body_hip: a.hip });
        if (s !== baseline) downFlip = d;
      }
      if (upFlip === undefined) {
        const s = computeBodyShape({ body_bust: a.bust, body_waist: (a.waist ?? 0) + d, body_hip: a.hip });
        if (s !== baseline) upFlip = d;
      }
      if (downFlip !== undefined && upFlip !== undefined) break;
    }
    console.log(
      `${padR(a.name, 26)} ${padR(String(baseline), 14)} ` +
      `${padL(downFlip !== undefined ? `-${downFlip}cm` : `>${MAX_SEARCH}cm`, 18)} ` +
      `${padL(upFlip !== undefined ? `+${upFlip}cm` : `>${MAX_SEARCH}cm`, 18)}`,
    );
  }
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION C — Does the shape actually change outfit outcomes?
// ═══════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(96));
console.log('SECTION C — Effect of body_shape on outfit scoring/ranking');
console.log('═'.repeat(96));

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    typeName?: string;
    fit?: FitItem['fit'];
    garmentMeasurements?: GarmentMeasurements;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'ITEM',
    colorProfile: {
      primaryColor: 'gray', colorLightness: 'medium', colorSaturation: 'muted',
      sat: 20, lum: 50, undertone: 'neutral',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    garmentMeasurements: opts.garmentMeasurements,
    styleTags: [],
    fit: opts.fit ?? 'regular',
    warmth: 2,
    formality: 2.5,
    statementStrength: 0.5,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

// Wardrobe — garment circumferences hand-picked around the mean of the 5
// canonical bodies below (mean bust~92, waist~75, hip~93, shoulder~39,
// upper_arm~27, sleeve~59, torso~40, inseam~76, thigh~55) so ease is
// meaningful (not floor/ceiling-clipped) across all 5 bodies, and each
// garment's ease is consistent with its declared `fit` (slim ≈ ideal ease,
// oversized ≈ far past the "ok" ceiling).
const slimJeans = fi('slim_jeans', 'bottom', {
  typeName: 'JEANS', fit: 'slim',
  garmentMeasurements: { waist: 78, hip: 98, inseam: 76, thigh: 59 },
});
// waist/hip CORRECTED 2026-08-03 (see FIXTURE CORRECTIONS note below, printed
// at the top of Section E) — both bottoms were authored under the old
// absolute-threshold model: waist/hip ease did not scale with the declared
// `wide`/`relaxed` fit at all (wide_leg_trousers' waist was even NEGATIVE —
// tighter at the waist than the wearer's own body, which no "wide" leg
// silhouette is). thigh/inseam were already consistent (thigh ease already
// scaled with the leg width the fit implies; inseam correctly does not move
// with fit) and are untouched.
const wideLegTrousers = fi('wide_leg_trousers', 'bottom', {
  typeName: 'TROUSERS', fit: 'wide',
  garmentMeasurements: { waist: 100, hip: 111, inseam: 79, thigh: 68 },
});
const relaxedChinos = fi('relaxed_chinos', 'bottom', {
  typeName: 'CHINOS', fit: 'relaxed',
  garmentMeasurements: { waist: 96, hip: 106, inseam: 76, thigh: 63 },
});
const slimTee = fi('slim_tee', 'top', {
  typeName: 'TEE', fit: 'slim',
  garmentMeasurements: { chest: 96, shoulder_width: 40, waist_top: 79, upper_arm: 30, body_length: 43 },
});
const regularShirt = fi('regular_shirt', 'top', {
  typeName: 'SHIRT', fit: 'regular',
  garmentMeasurements: { chest: 100, shoulder_width: 41, waist_top: 82, upper_arm: 31, sleeves: 60, body_length: 44 },
});
// waist_top/waist_outer CORRECTED 2026-08-03 (see FIXTURE CORRECTIONS note below,
// printed at the top of Section E) — a straight-hanging loose garment's waist
// circumference sits close to its chest circumference; it does NOT taper like a
// fitted piece. The previous values tapered 13-15cm from chest to waist, which
// is fitted-garment taper, not boxy/straight construction, and produced a waist
// ease SMALLER than the chest ease on a body whose own waist is narrower than
// its chest — physically backwards for this cut. Only waist_top/waist_outer
// changed; chest/shoulder/upper_arm/sleeves/body_length are untouched.
const oversizedHoodie = fi('oversized_hoodie', 'top', {
  typeName: 'HOODIE', fit: 'oversized',
  garmentMeasurements: { chest: 114, shoulder_width: 47, waist_top: 106, upper_arm: 41, sleeves: 65, body_length: 50 },
});
const oversizedKnit = fi('oversized_knit', 'top', {
  typeName: 'KNIT', fit: 'oversized',
  garmentMeasurements: { chest: 112, shoulder_width: 46, waist_top: 106, upper_arm: 39, sleeves: 63, body_length: 48 },
});
const structuredBlazer = fi('structured_slim_blazer', 'outwear', {
  typeName: 'BLAZER', fit: 'slim',
  garmentMeasurements: { chest: 97, shoulder_width: 41, waist_outer: 81, upper_arm: 30, sleeves: 60 },
});
// chest CORRECTED 2026-08-03 (same pass as wide_leg_trousers/relaxed_chinos
// above) — at ease 6cm it undershot the ideal window a 'relaxed' fit implies
// for this body (6.8-10.8cm); shoulder/waist_outer/upper_arm/sleeves already
// scaled correctly with the fit and are untouched.
const relaxedOvershirt = fi('relaxed_overshirt', 'outwear', {
  typeName: 'OVERSHIRT', fit: 'relaxed',
  garmentMeasurements: { chest: 105, shoulder_width: 43, waist_outer: 98, upper_arm: 34, sleeves: 62 },
});
const sneakers = fi('sneakers', 'shoes', { typeName: 'SNEAKERS', fit: 'regular' });

const WARDROBE: FitItem[] = [
  slimJeans, wideLegTrousers, relaxedChinos, slimTee, regularShirt,
  oversizedHoodie, oversizedKnit, structuredBlazer, relaxedOvershirt, sneakers,
];

console.log('Wardrobe (id, category, fit, VOLUME):');
{
  const header = `${padR('id', 26)} ${padR('category', 10)} ${padR('fit', 10)} ${padL('VOLUME', 8)}`;
  console.log(header);
  console.log(rule(header.length));
  for (const item of WARDROBE) {
    console.log(`${padR(item.id, 26)} ${padR(item.category, 10)} ${padR(item.fit, 10)} ${padL(String(VOLUME[item.fit]), 8)}`);
  }
  console.log('');
}

interface NamedOutfit { name: string; items: FitItem[] }
const OUTFITS: NamedOutfit[] = [
  { name: 'all-slim tailored',        items: [slimTee, slimJeans, structuredBlazer] },
  { name: 'slim top + wide bottom',   items: [slimTee, wideLegTrousers] },
  { name: 'oversized top + slim bottom', items: [oversizedHoodie, slimJeans] },
  { name: 'all-oversized',            items: [oversizedKnit, wideLegTrousers] },
  { name: 'layered 3-piece',          items: [slimTee, relaxedOvershirt, slimJeans] },
  { name: 'regular baseline',         items: [regularShirt, relaxedChinos] },
];

// 5 canonical bodies, one per shape (same B/W/H as Section A's 5 female
// archetypes, extended with the other measurement fields the wardrobe's
// garments actually key on, so scoreItemFit produces real `measured: true`
// points rather than defaulting to 0.5 neutrals).
interface CanonicalBody { shape: EngineBodyShape; body: EngineBodyMeasurements }
const CANONICAL_BODIES: CanonicalBody[] = [
  { shape: 'hourglass', body: {
    body_bust: 90, body_waist: 66, body_hip: 92,
    body_shoulder_width: 38, body_upper_arm: 27, body_sleeve_length: 58,
    body_upper_body_length: 40, body_inseam: 76, body_thigh: 54,
    body_height: 165, body_weight: 58,
  } },
  { shape: 'triangle', body: {
    body_bust: 86, body_waist: 70, body_hip: 100,
    body_shoulder_width: 37, body_upper_arm: 26, body_sleeve_length: 58,
    body_upper_body_length: 40, body_inseam: 77, body_thigh: 58,
    body_height: 163, body_weight: 62,
  } },
  { shape: 'apple', body: {
    body_bust: 96, body_waist: 88, body_hip: 96,
    body_shoulder_width: 39, body_upper_arm: 29, body_sleeve_length: 59,
    body_upper_body_length: 41, body_inseam: 75, body_thigh: 56,
    body_height: 166, body_weight: 68,
  } },
  { shape: 'rectangle', body: {
    body_bust: 88, body_waist: 74, body_hip: 90,
    body_shoulder_width: 37, body_upper_arm: 26, body_sleeve_length: 58,
    body_upper_body_length: 40, body_inseam: 76, body_thigh: 54,
    body_height: 164, body_weight: 60,
  } },
  { shape: 'inverted_triangle', body: {
    body_bust: 98, body_waist: 76, body_hip: 88,
    body_shoulder_width: 42, body_upper_arm: 29, body_sleeve_length: 60,
    body_upper_body_length: 41, body_inseam: 75, body_thigh: 53,
    body_height: 170, body_weight: 64,
  } },
];

function withShape(body: EngineBodyMeasurements, shape: EngineBodyShape | undefined): EngineBodyMeasurements {
  const { body_shape: _drop, ...rest } = body;
  return shape === undefined ? rest : { ...rest, body_shape: shape };
}

interface Row {
  bodyShape: EngineBodyShape;
  outfitName: string;
  base: number;
  shaped: number;
  delta: number;
  rawMult: number;
  silhouette: string;
}

const rows: Row[] = [];
for (const cb of CANONICAL_BODIES) {
  const unshaped = withShape(cb.body, undefined);
  const shapedBody = withShape(cb.body, cb.shape);
  for (const outfit of OUTFITS) {
    const base = scoreOutfitFit(outfit.items, unshaped);
    const shaped = scoreOutfitFit(outfit.items, shapedBody);
    const delta = bodyShapeAdjustment(outfit.items, cb.shape);
    const rawMult = bodyShapeMultiplier(outfit.items, cb.shape);
    const silhouette = resultingBodySilhouette(outfit.items, cb.shape);
    rows.push({ bodyShape: cb.shape, outfitName: outfit.name, base, shaped, delta, rawMult, silhouette });
  }
}

for (const cb of CANONICAL_BODIES) {
  console.log(`\nBody shape: ${cb.shape}`);
  const header = `${padR('outfit', 26)} ${padL('base', 8)} ${padL('shaped', 8)} ${padL('delta', 8)} ${padL('rawMult', 9)} ${padR('resultSilhouette', 18)}`;
  console.log(header);
  console.log(rule(header.length));
  const myRows = rows.filter(r => r.bodyShape === cb.shape);
  for (const r of myRows) {
    console.log(
      `${padR(r.outfitName, 26)} ${padL(r.base.toFixed(3), 8)} ${padL(r.shaped.toFixed(3), 8)} ` +
      `${padL((r.delta >= 0 ? '+' : '') + r.delta.toFixed(3), 8)} ${padL((r.rawMult >= 0 ? '+' : '') + r.rawMult.toFixed(3), 9)} ` +
      `${padR(r.silhouette, 18)}`,
    );
  }

  // Ranking: base-desc vs shaped-desc
  const byBase = [...myRows].sort((a, b) => b.base - a.base).map(r => r.outfitName);
  const byShaped = [...myRows].sort((a, b) => b.shaped - a.shaped).map(r => r.outfitName);
  const top1Changed = byBase[0] !== byShaped[0];
  let maxDisplacement = 0;
  for (const name of byBase.map(r => r)) {
    const bIdx = byBase.indexOf(name);
    const sIdx = byShaped.indexOf(name);
    maxDisplacement = Math.max(maxDisplacement, Math.abs(bIdx - sIdx));
  }
  console.log(`  Ranking by base:   ${byBase.join(' > ')}`);
  console.log(`  Ranking by shaped: ${byShaped.join(' > ')}`);
  console.log(`  Top-1 changed: ${top1Changed ? 'YES' : 'no'}   Max rank displacement: ${maxDisplacement}`);

  // Target silhouette resolution for this shape (full wardrobe as `items` arg
  // — used only to compute `confidence`, i.e. how much of it carries real
  // fit data).
  const ctx: EngineContext = {
    bodyMeasurements: withShape(cb.body, cb.shape),
    styleProfile: { selectedStyles: [] },
    colorPreferences: [],
  };
  const target = resolveTargetSilhouette(ctx, WARDROBE);
  console.log(
    `  resolveTargetSilhouette: source="${target.source}" confidence=${target.confidence.toFixed(3)} ` +
    `targets=[${target.targets.map(t => `${t.label}(top${t.topVol}/bot${t.bottomVol} w${t.weight})`).join(', ')}]`,
  );
}

// Direction-consistency check: does the outfit with the HIGHEST shape delta
// also score at least as well against resolveTargetSilhouette's target as the
// outfit with the LOWEST (most negative) delta? Uses pairSilhouetteMatch on
// each outfit's first top/outwear item + first bottom item.
function firstTop(items: FitItem[]): FitItem | undefined {
  return items.find(i => i.category === 'top') ?? items.find(i => i.category === 'outwear');
}
function firstBottom(items: FitItem[]): FitItem | undefined {
  return items.find(i => i.category === 'bottom');
}

interface Contradiction { shape: EngineBodyShape; hiOutfit: string; loOutfit: string; hiMatch: number; loMatch: number }
const contradictions: Contradiction[] = [];
for (const cb of CANONICAL_BODIES) {
  const ctx: EngineContext = {
    bodyMeasurements: withShape(cb.body, cb.shape),
    styleProfile: { selectedStyles: [] },
    colorPreferences: [],
  };
  const target = resolveTargetSilhouette(ctx, WARDROBE);
  const myRows = rows.filter(r => r.bodyShape === cb.shape);
  const hi = myRows.reduce((a, b) => (b.delta > a.delta ? b : a));
  const lo = myRows.reduce((a, b) => (b.delta < a.delta ? b : a));
  const hiOutfit = OUTFITS.find(o => o.name === hi.outfitName)!;
  const loOutfit = OUTFITS.find(o => o.name === lo.outfitName)!;
  const hiTop = firstTop(hiOutfit.items), hiBottom = firstBottom(hiOutfit.items);
  const loTop = firstTop(loOutfit.items), loBottom = firstBottom(loOutfit.items);
  if (hiTop && hiBottom && loTop && loBottom) {
    const hiMatch = pairSilhouetteMatch(hiTop, hiBottom, target);
    const loMatch = pairSilhouetteMatch(loTop, loBottom, target);
    if (hiMatch < loMatch) {
      contradictions.push({ shape: cb.shape, hiOutfit: hi.outfitName, loOutfit: lo.outfitName, hiMatch, loMatch });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION C addendum — item-level fit breakdown (uses scoreItemFit directly)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\nItem-level fit breakdown (scoreItemFit) — sample diagnostics:');
{
  const samples: Array<{ item: FitItem; body: CanonicalBody }> = [
    { item: oversizedHoodie, body: CANONICAL_BODIES.find(b => b.shape === 'apple')! },
    { item: slimJeans, body: CANONICAL_BODIES.find(b => b.shape === 'triangle')! },
    { item: structuredBlazer, body: CANONICAL_BODIES.find(b => b.shape === 'hourglass')! },
  ];
  for (const s of samples) {
    const result = scoreItemFit(s.item, s.body.body);
    console.log(`  ${s.item.id} on ${s.body.shape} body: measured=${result.measured} score=${result.score.toFixed(3)}`);
    for (const p of result.points) {
      console.log(`    ${padR(p.key, 14)} ease=${padL(p.ease.toFixed(1), 6)} category=${padR(p.category, 10)} score=${p.score.toFixed(2)}`);
    }
    if (result.warnings.length) console.log(`    warnings: ${result.warnings.join('; ')}`);
  }
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION D — VERDICT
// ═══════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(96));
console.log('SECTION D — VERDICT');
console.log('═'.repeat(96));

const classifierPass = ARCHETYPES.filter(a => computeBodyShape(toClientMeasurements(a)) === a.expected).length;
console.log(`Classifier pass rate: ${classifierPass}/${ARCHETYPES.length} (${((100 * classifierPass) / ARCHETYPES.length).toFixed(1)}%)`);

{
  let maxShare = 0; let maxLabel = '';
  for (const s of SHAPE_LABELS) {
    const c = sweepCounts.get(String(s)) ?? 0;
    const pct = (100 * c) / accepted;
    if (pct > maxShare) { maxShare = pct; maxLabel = String(s); }
  }
  console.log(`Shape distribution skew: max label share = "${maxLabel}" at ${maxShare.toFixed(1)}% (of ${accepted} sampled bodies)`);
}

const meaningfulDeltaCount = rows.filter(r => Math.abs(r.delta) > 0.01).length;
console.log(`(body, outfit) pairs with |delta| > 0.01: ${meaningfulDeltaCount} / ${rows.length}`);

let top1ChangedCount = 0;
for (const cb of CANONICAL_BODIES) {
  const myRows = rows.filter(r => r.bodyShape === cb.shape);
  const byBase = [...myRows].sort((a, b) => b.base - a.base).map(r => r.outfitName);
  const byShaped = [...myRows].sort((a, b) => b.shaped - a.shaped).map(r => r.outfitName);
  if (byBase[0] !== byShaped[0]) top1ChangedCount++;
}
console.log(`Bodies where the shape signal changed the top-1 outfit: ${top1ChangedCount} / ${CANONICAL_BODIES.length}`);

console.log(`Direction contradictions (shape delta vs resolveTargetSilhouette target): ${contradictions.length}`);
for (const c of contradictions) {
  console.log(
    `  ${c.shape}: highest-delta outfit "${c.hiOutfit}" matches target worse (${c.hiMatch.toFixed(3)}) ` +
    `than lowest-delta outfit "${c.loOutfit}" (${c.loMatch.toFixed(3)})`,
  );
}
if (contradictions.length === 0) console.log('  (none found — shape delta direction agrees with target silhouette direction for all 5 bodies)');

// ═══════════════════════════════════════════════════════════════════════════
// SECTION E — Fit-relative ease windows (Part 1) + preferred-fit anchor (Part 2)
// ═══════════════════════════════════════════════════════════════════════════
// Proves the backlog fix: FIT_THRESHOLDS now SLIDES by how much ease the
// garment's declared `fit` is supposed to have (scaled proportionally to the
// body measurement, per KEY_EASE_WEIGHT), instead of judging every garment
// against one absolute window regardless of design intent.

console.log('\n' + '═'.repeat(96));
console.log('SECTION E — Fit-relative ease (Part 1) + preferred-fit anchor (Part 2)');
console.log('═'.repeat(96));

// ─── KEY_EASE_WEIGHT + fixture recalibration, 2026-08-03 ─────────────────────
// KEY_EASE_WEIGHT changed (encodes CUT, not misfit tolerance):
//   thigh 0.6->0.9, upper_arm 0.6->0.9, shoulder_width 0.35->0.9,
//   sleeves 0->0.3, body_length 0.25->0.4  (chest/waist*/hip/inseam unchanged)
// Fixture correction — 3 straight-hanging garments had a waist_top/waist_outer
// tapered 13-15cm below chest, which is FITTED-garment taper, not the boxy/
// straight cut their declared fit implies. A straight-hanging piece's waist
// circumference sits close to its chest circumference, so only these two keys
// changed; chest/shoulder/upper_arm/sleeves/body_length are untouched:
console.log('\nFixture corrections (waist_top/waist_outer only, straight-hanging construction):');
console.log('  id                      key          before  after  reason');
console.log('  oversized_hoodie        waist_top       99    106   boxy hoodie hangs ~straight from chest to waist');
console.log('  oversized_knit          waist_top       95    106   same straight-hang construction as the hoodie');
console.log('  relaxed_overshirt       waist_outer     87     98   relaxed overshirt is not darted/tapered at the waist');
// Second pass, 2026-08-03 — the BOTTOMS (+ relaxed_overshirt's chest) had the
// same defect: waist/hip/chest ease authored under the old absolute-threshold
// model did not scale with the declared fit at all (wide_leg_trousers' waist
// ease was even NEGATIVE). Evidence these were the odd ones out: each scored
// LOWER with a real fit label than with a guessed one — a correctly-cut
// garment must score BETTER when its label is trusted, never worse. thigh/
// inseam (bottoms) and shoulder/waist_outer/upper_arm/sleeves (overshirt)
// were already internally consistent and are untouched.
console.log('\nFixture corrections (waist/hip/chest, fit-ease scaling):');
console.log('  id                      key         before  after  reason');
console.log('  wide_leg_trousers       waist          84    100   waist ease must scale with a WIDE leg (was tighter than the body itself: ease -4)');
console.log('  wide_leg_trousers       hip           106    111   hip ease undershot the wide-fit ideal window (was ease 10, needs ~14-18)');
console.log('  relaxed_chinos          waist          82     96   waist ease must scale with a RELAXED leg (was tighter than the body itself: ease -6)');
console.log('  relaxed_chinos          hip           102    106   hip ease undershot the relaxed-fit ideal window (was ease 6, needs ~9-13)');
console.log('  relaxed_overshirt       chest         102    105   chest ease undershot the relaxed-fit ideal window (was ease 6, needs ~7-11)');

// ─── E1 — scoreItemFit for the full WARDROBE, one canonical body ─────────────
// Reuses the exact WARDROBE/oversizedHoodie fixtures from Section C (same
// body — 'apple' — that produced the quoted 0.293 crush under the old
// absolute thresholds). Shown two ways: as the WARDROBE items actually are
// (provenance.fit=false, i.e. a GUESSED fit label — the realistic case for
// most wardrobe rows today) and with provenance.fit=true (a REAL declared
// fit), so both the realistic and the best-case effect of the fix are
// visible. GUESS-WIDENING UPDATE (2026-08-03): a guessed label now shifts the
// window at the SAME full strength as a real label (the previous
// `shiftCm *= 0.5` halving parked the window halfway between the regular and
// labelled-fit window, matching neither — it crushed oversized_hoodie's
// guessed-fit score to 0.404). Instead, a guessed label only widens the `ok`
// band by GUESS_WIDENING on both sides, so a wrong guess degrades gracefully
// instead of scoring near 0, while `ideal` stays unwidened.
console.log("\nE1 — scoreItemFit for the full WARDROBE on the 'apple' canonical body:");
{
  const appleBody = CANONICAL_BODIES.find(b => b.shape === 'apple')!.body;

  function withRealFitProvenance(item: FitItem): FitItem {
    return { ...item, provenance: { ...item.provenance, fit: true } };
  }

  const header = `${padR('id', 26)} ${padR('fit', 10)} ${padL('guessed-fit score', 18)} ${padL('real-fit score', 15)}`;
  console.log(header);
  console.log(rule(header.length));
  for (const item of WARDROBE) {
    const guessed = scoreItemFit(item, appleBody);
    const real = scoreItemFit(withRealFitProvenance(item), appleBody);
    console.log(
      `${padR(item.id, 26)} ${padR(item.fit, 10)} ` +
      `${padL(guessed.measured ? guessed.score.toFixed(3) : 'n/a', 18)} ` +
      `${padL(real.measured ? real.score.toFixed(3) : 'n/a', 15)}`,
    );
  }

  console.log("\noversized_hoodie detail (used to score 0.293 under the old absolute thresholds):");
  const hoodieGuessed = scoreItemFit(oversizedHoodie, appleBody);
  const hoodieReal = scoreItemFit(withRealFitProvenance(oversizedHoodie), appleBody);
  console.log(`  GUESSED fit (provenance.fit=false, full shift + widened ok band): total score = ${hoodieGuessed.score.toFixed(3)}`);
  for (const p of hoodieGuessed.points) {
    console.log(`    ${padR(p.key, 14)} ease=${padL(p.ease.toFixed(1), 6)} category=${padR(p.category, 10)} score=${p.score.toFixed(2)}`);
  }
  console.log(`  REAL fit (provenance.fit=true, full shift, unwidened window): total score = ${hoodieReal.score.toFixed(3)}`);
  for (const p of hoodieReal.points) {
    console.log(`    ${padR(p.key, 14)} ease=${padL(p.ease.toFixed(1), 6)} category=${padR(p.category, 10)} score=${p.score.toFixed(2)}`);
  }
  console.log('');
}

// ─── E2 — a genuinely-too-small garment must STILL score badly + warn ────────
// Guard against Part 1 over-correcting into "everything passes": a slim tee
// with chest ease -4 (below the ok[0]=0 floor even before any shift) must
// still floor to (near) 0 and still emit a tight warning. NEW GUARD (2026-08-03,
// same treatment as E4): checked under BOTH a real (provenance.fit=true) and a
// guessed (provenance.fit=false) declared fit — this is exactly the girth-floor
// safety fix (shiftThresholds never lets a girth window's ok[0] fall below its
// original table value), so a wrong guess must not be able to widen the window
// enough to let an unwearably-small garment through either. THROWS on failure —
// a safety guard that only prints is not a guard.
console.log('E2 — a genuinely-too-small garment must still score badly and still warn:');
{
  const tightBody: EngineBodyMeasurements = { body_bust: 90 };
  const tooSmallSlimTeeGuessed = fi('too_small_slim_tee_guessed', 'top', {
    typeName: 'TEE', fit: 'slim', garmentMeasurements: { chest: 86 }, // ease = 86 - 90 = -4
  });
  const tooSmallSlimTeeReal: FitItem = {
    ...tooSmallSlimTeeGuessed,
    id: 'too_small_slim_tee_real',
    provenance: { ...tooSmallSlimTeeGuessed.provenance, fit: true },
  };

  for (const [label, item] of [['GUESSED', tooSmallSlimTeeGuessed], ['REAL', tooSmallSlimTeeReal]] as const) {
    const result = scoreItemFit(item, tightBody);
    const chestPoint = result.points.find(p => p.key === 'Chest');
    const pass = result.score <= 0.15 && result.warnings.length > 0;
    console.log(`  [${label}] chest ease = ${chestPoint ? chestPoint.ease.toFixed(1) : 'n/a'}, total score = ${result.score.toFixed(3)}`);
    console.log(`  [${label}] category = ${chestPoint?.category ?? 'n/a'}, warnings = [${result.warnings.join('; ')}]`);
    console.log(`  [${label}] PASS (score <= 0.15 AND a tight warning fired): ${pass ? 'YES' : 'NO'}`);
    if (!pass) {
      throw new Error(`E2 guard failed (${label}): too-small slim garment scored ${result.score.toFixed(3)} with ${result.warnings.length} warning(s), expected score <= 0.15 and >= 1 warning`);
    }
  }
  console.log('');
}

// ─── E3 — scoreOutfitFit for all 6 outfits under different preferredFit ──────
// Same OUTFITS/body as Section C's ranking table (rectangle body, shape
// stripped via withShape(...,undefined) so the ranking shift is attributable
// to preferredFitDelta rather than entangled with the body-shape delta).
console.log("E3 — scoreOutfitFit ranking for all 6 outfits, by preferredFit:");
{
  const baseBody = withShape(CANONICAL_BODIES.find(b => b.shape === 'rectangle')!.body, undefined);
  const prefs: Array<PreferredFit | undefined> = [undefined, 'SLIM', 'OVERSIZED'];

  for (const pref of prefs) {
    const body: EngineBodyMeasurements = { ...baseBody, preferredFit: pref };
    const scored = OUTFITS.map(o => ({
      name: o.name,
      score: scoreOutfitFit(o.items, body),
      delta: preferredFitDelta(o.items, pref),
    }));
    const ranked = [...scored].sort((a, b) => b.score - a.score);
    console.log(`\n  preferredFit = ${pref ?? 'undefined'}`);
    const header = `  ${padR('outfit', 26)} ${padL('score', 8)} ${padL('prefDelta', 10)}`;
    console.log(header);
    console.log('  ' + rule(header.length - 2));
    for (const r of ranked) {
      console.log(`  ${padR(r.name, 26)} ${padL(r.score.toFixed(3), 8)} ${padL((r.delta >= 0 ? '+' : '') + r.delta.toFixed(3), 10)}`);
    }
    console.log(`  Ranking: ${ranked.map(r => r.name).join(' > ')}`);
  }

  console.log(
    '\n  Sanity: does the SLIM-preferring ranking favour slim-heavier outfits over the ' +
    'OVERSIZED-preferring ranking (rank of "all-slim tailored" lower/earlier under SLIM)?',
  );
  const rankOf = (pref: PreferredFit | undefined, name: string): number => {
    const body: EngineBodyMeasurements = { ...baseBody, preferredFit: pref };
    const ranked = [...OUTFITS]
      .map(o => ({ name: o.name, score: scoreOutfitFit(o.items, body) }))
      .sort((a, b) => b.score - a.score);
    return ranked.findIndex(r => r.name === name);
  };
  const slimRank = rankOf('SLIM', 'all-slim tailored');
  const oversizedRankOfSlimOutfit = rankOf('OVERSIZED', 'all-slim tailored');
  console.log(
    `  "all-slim tailored" rank under SLIM preference: #${slimRank + 1}; ` +
    `under OVERSIZED preference: #${oversizedRankOfSlimOutfit + 1} ` +
    `(lower index = ranked higher). Expected: ranked higher (lower index) under SLIM.`,
  );
}

// ─── E4 — NEW GUARD: a label-mismatched "oversized" garment must still fail ──
// The recalibration moves the oversized window OUTWARD (more ease expected).
// That must not become "everything oversized passes" — a garment DECLARED
// oversized but actually cut nearly to body measurements (chest ease 2cm, i.e.
// barely more than a second skin) has missed its own label's window and must
// still score badly. Checked under BOTH a real and a guessed declared fit —
// THROWS on failure (a safety guard that only prints is not a guard).
console.log('\nE4 — a garment declared oversized but cut nearly to body measurements must still score badly:');
{
  const appleBody = CANONICAL_BODIES.find(b => b.shape === 'apple')!.body;
  const base = fi('mislabelled_oversized_top', 'top', {
    typeName: 'TOP', fit: 'oversized',
    garmentMeasurements: { chest: (appleBody.body_bust ?? 0) + 2 }, // ease = 2cm
  });
  const mislabelledOversizedReal: FitItem = {
    ...base, id: 'mislabelled_oversized_top_real',
    provenance: { fit: true, material: false, pattern: false, warmthSeason: false },
  };
  const mislabelledOversizedGuessed: FitItem = {
    ...base, id: 'mislabelled_oversized_top_guessed',
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };

  for (const [label, item] of [['REAL', mislabelledOversizedReal], ['GUESSED', mislabelledOversizedGuessed]] as const) {
    const result = scoreItemFit(item, appleBody);
    const chestPoint = result.points.find(p => p.key === 'Chest');
    const pass = result.score <= 0.15;
    console.log(`  [${label}] declared fit = oversized, chest ease = ${chestPoint ? chestPoint.ease.toFixed(1) : 'n/a'}, total score = ${result.score.toFixed(3)}`);
    console.log(`  [${label}] category = ${chestPoint?.category ?? 'n/a'}`);
    console.log(`  [${label}] PASS (an "oversized"-labelled garment cut to near-body measurements scores <= 0.15): ${pass ? 'YES' : 'NO'}`);
    if (!pass) throw new Error(`E4 guard failed (${label}): mislabelled-oversized garment scored ${result.score.toFixed(3)}, expected <= 0.15`);
  }
}

console.log('\nDone.');
