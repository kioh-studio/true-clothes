// Offline eval harness — runs the generate-outfits engine against a FIXED
// fixture wardrobe (fixture.ts) and emits a deterministic top-10 feed snapshot.
// No DB, no LLM curation, no daily shuffle: this mirrors the rule-engine path
// of supabase/functions/generate-outfits/index.ts only.
//
// Usage:
//   deno run --allow-read --allow-write scripts/eval-feed/run.ts \
//     --engine supabase/functions/generate-outfits/engine --out snapshot.json \
//     [--profile smartcasual|streetwear|resort|measured|measured-goal]
//
// Note: the engine directory is loaded via a dynamic `file://` import so two
// engine versions (e.g. a baseline copy vs. the live tree) can be compared
// without touching supabase/functions/. --allow-write is required in addition
// to --allow-read because this script writes the snapshot JSON to --out.
//
// --profile selects which fixture wardrobe + user profile to run (see
// fixture.ts PROFILES). Defaults to 'smartcasual' so existing invocations and
// baseline snapshots are unaffected.

import { PROFILES, ProfileName } from './fixture.ts';

// ─── CLI args ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = argv[i + 1];
      out[key] = val ?? '';
      i++;
    }
  }
  return out;
}

const args = parseArgs(Deno.args);
const engineDirArg = args.engine;
const outPath = args.out;
const profileName = (args.profile || 'smartcasual') as ProfileName;

if (!engineDirArg || !outPath) {
  console.error('Usage: deno run --allow-read --allow-write run.ts --engine <dir> --out <snapshot.json> [--profile smartcasual|streetwear|resort|measured|measured-goal]');
  Deno.exit(1);
}

const selectedFixture = PROFILES[profileName];
if (!selectedFixture) {
  console.error(`Unknown --profile "${profileName}". Available: ${Object.keys(PROFILES).join(', ')}`);
  Deno.exit(1);
}

const { wardrobe: WARDROBE, profile: PROFILE } = selectedFixture;

// ─── Windows-safe path → file:// URL ──────────────────────────────────────
// Handles absolute Windows paths (C:\foo\bar or C:/foo/bar), absolute POSIX
// paths (/foo/bar), and relative paths (resolved against Deno.cwd()).

function toFileDirUrl(p: string): string {
  let abs = p.replace(/\\/g, '/');
  const isWindowsAbs = /^[a-zA-Z]:\//.test(abs);
  const isPosixAbs = abs.startsWith('/');
  if (!isWindowsAbs && !isPosixAbs) {
    abs = `${Deno.cwd().replace(/\\/g, '/')}/${abs}`;
  }
  if (/^[a-zA-Z]:\//.test(abs)) {
    abs = `/${abs}`; // file:///C:/foo/bar
  }
  abs = abs.replace(/\/+$/, ''); // strip trailing slash
  return `file://${abs}`;
}

const engineBaseUrl = toFileDirUrl(engineDirArg);

// ─── Dynamic import of the target engine ──────────────────────────────────

const enrichmentMod = await import(`${engineBaseUrl}/enrichment.ts`);
const filteringMod = await import(`${engineBaseUrl}/filtering.ts`);
const generationMod = await import(`${engineBaseUrl}/generation.ts`);
const rankingMod = await import(`${engineBaseUrl}/ranking.ts`);

const { toFitItem, colorProfileOf } = enrichmentMod;
const { filterByStyle, styleConfigById } = filteringMod;
const { generateCandidates, generateHeroCandidates, GENERATION_CAP } = generationMod;
const { rankCandidates } = rankingMod;

// ─── Quality gate — mirrors index.ts constants exactly ────────────────────

const MIN_QUALITY = 0.50;
const QUALITY_BAND = 0.18;
const MIN_FEED = 3;

// deno-lint-ignore no-explicit-any
function applyQualityGate(ranked: any[]): any[] {
  if (ranked.length <= MIN_FEED) return ranked;
  const best = ranked.reduce((m, o) => Math.max(m, o.totalScore), 0);
  const cut = Math.max(MIN_QUALITY, best - QUALITY_BAND);
  const qualified = ranked.filter(o => o.totalScore >= cut);
  return qualified.length >= MIN_FEED ? qualified : ranked.slice(0, MIN_FEED);
}

// ─── Fixed seed — constant across runs so the snapshot is deterministic ───

const SEED = 'eval:fixed-seed-001';

// a. Enrich
// deno-lint-ignore no-explicit-any
const fitItems: any[] = WARDROBE.map(toFitItem);

// b. Style filter — union of items passing ANY selected style; scoring weights
//    come from the FIRST selected style's config (mirrors index.ts step 3).
// deno-lint-ignore no-explicit-any
const styleConfigs: any[] = PROFILE.selectedStyles
  .map((id: string) => styleConfigById(id))
  .filter((c: unknown): c is NonNullable<typeof c> => c !== undefined);

const passedIds = new Set<string>();
for (const config of styleConfigs) {
  for (const item of filterByStyle(fitItems, config).passed) passedIds.add(item.id);
}
// deno-lint-ignore no-explicit-any
const filteredItems: any[] = fitItems.filter((i: { id: string }) => passedIds.has(i.id));
const scoringWeights = styleConfigs[0]?.weights;

console.log(`[eval] engine=${engineDirArg} profile=${profileName}`);
console.log(`[eval] fitItems=${fitItems.length} → style-filtered=${filteredItems.length} (styles=${PROFILE.selectedStyles.join(',')})`);

// shapeGoal (010-wardrobe-critic follow-up, 2026-08-11): only the
// 'measured-goal' profile sets this; the other four don't declare the field
// at all. Cast narrowly here rather than widening every PROFILE object's
// type to include an optional shapeGoal — keeps the three protected
// fixtures' profile consts (smartcasual/streetwear/resort) completely
// untouched. undefined for any profile that doesn't set it, which is
// shapeGoalDelta's own OFF condition (ranking.ts) — zero behavior change
// for existing profiles.
const shapeGoal = (PROFILE as { shapeGoal?: string }).shapeGoal;

// c. Engine context
const ctx = {
  bodyMeasurements: PROFILE.bodyMeasurements,
  styleProfile: { selectedStyles: PROFILE.selectedStyles },
  colorPreferences: PROFILE.colorPreferences,
  colorSeason: PROFILE.colorSeason,
  weatherSeason: PROFILE.weatherSeason,
  scoringWeights,
  shapeGoal,
};

// d. Generate candidates: hero candidates PREPENDED to formula candidates,
//    sliced to GENERATION_CAP. Seed is always passed (never undefined) so
//    generation never falls back to Math.random — this is what makes the
//    snapshot reproducible across runs.
const userPalette = PROFILE.colorPreferences.map((c: string) => colorProfileOf(c).primaryColor);
const heroCandidates = generateHeroCandidates(filteredItems, SEED, userPalette);
const formulaCandidates = generateCandidates(filteredItems, undefined, SEED);
const candidates = [...heroCandidates, ...formulaCandidates].slice(0, GENERATION_CAP);

console.log(`[eval] hero candidates=${heroCandidates.length}, formula candidates=${formulaCandidates.length}, total (capped)=${candidates.length}`);

// e. Rank
const itemMap = new Map(filteredItems.map((i: { id: string }) => [i.id, i]));
const ranked = rankCandidates(candidates, itemMap, ctx);

// f. Quality gate
const gated = applyQualityGate(ranked);

console.log(`[eval] ranked=${ranked.length} → quality-gated=${gated.length}`);

// g. Top 10, no shuffle
// deno-lint-ignore no-explicit-any
const top10: any[] = gated.slice(0, 10);

// ─── Build snapshot ────────────────────────────────────────────────────────

const rowById = new Map(WARDROBE.map(r => [r.id, r]));

function describeSlot(id: string | undefined) {
  if (!id) return undefined;
  const r = rowById.get(id);
  if (!r) return undefined;
  return {
    name: r.name,
    type: r.type,
    color: r.color,
    material: r.material ?? null,
    fit: r.fit ?? null,
    pattern: r.pattern ?? null,
  };
}

// deno-lint-ignore no-explicit-any
const outfits = top10.map((o: any, idx: number) => {
  const isOnepiece = o.slots.top === o.slots.bottom;
  const items: Array<{ slot: string } & Record<string, unknown>> = [];

  if (isOnepiece) {
    items.push({ slot: 'onepiece', ...describeSlot(o.slots.top) });
  } else {
    items.push({ slot: 'top', ...describeSlot(o.slots.top) });
    items.push({ slot: 'bottom', ...describeSlot(o.slots.bottom) });
  }
  items.push({ slot: 'shoes', ...describeSlot(o.slots.shoes) });
  if (o.slots.outwear) items.push({ slot: 'outwear', ...describeSlot(o.slots.outwear) });
  if (o.slots.accessory) items.push({ slot: 'accessory', ...describeSlot(o.slots.accessory) });

  return {
    rank: idx + 1,
    formula: o.formula,
    tier: o.tier,
    totalScore: o.totalScore,
    dims: {
      styleCoherence: o.styleCoherence,
      colorHarmony: o.colorHarmony,
      fitScore: o.fitScore,
      proportionBalance: o.proportionBalance,
      formalityConsistency: o.formalityConsistency,
      seasonMatch: o.seasonMatch,
      textureInterest: o.textureInterest,
    },
    items,
  };
});

const snapshot = {
  engineDir: engineDirArg,
  generatedFor: 'eval-fixture-v1',
  outfits,
};

await Deno.writeTextFile(outPath, JSON.stringify(snapshot, null, 2));

// ─── Human-readable table ───────────────────────────────────────────────────

console.log(`\nTop ${outfits.length} outfits (engine: ${engineDirArg})\n`);
console.log('Rank  Score  Tier  Formula             Items');
console.log('----  -----  ----  ------------------  ' + '-'.repeat(60));
for (const o of outfits) {
  const itemNames = o.items.map(i => `${i.slot}:${i.name}`).join(' | ');
  console.log(
    `${String(o.rank).padStart(4)}  ${o.totalScore.toFixed(3)}  ${o.tier}     ${o.formula.padEnd(18)}  ${itemNames}`,
  );
}
console.log(`\nWrote snapshot → ${outPath}`);

if (outfits.length === 0) {
  console.warn('[eval] WARNING: feed is empty — fixture may be too sparse or the style filter killed everything.');
}
