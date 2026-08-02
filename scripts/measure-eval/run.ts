// measure-eval — offline body-measurement accuracy/calibration harness.
//
// Replays captured on-device scans (fixtures/*.json — raw keypoints +
// silhouette widths + the inputs given at scan time) against the SAME pure
// `keypointsToMeasurements` used by the app, diffs the prediction against a
// tape-measure ground truth, and prints per-field bias/MAE/RMSE plus a
// suggested calibration. See fixtures/README.md for the fixture schema and
// how to capture one from a dev build.
//
// Usage (run from the repo root, matching scripts/eval-feed/run.ts's mechanism):
//   deno run --allow-read --sloppy-imports scripts/measure-eval/run.ts
//   deno run --allow-read --sloppy-imports scripts/measure-eval/run.ts --calibrate
//
// --sloppy-imports is required (unlike eval-feed, which targets Deno-native
// engine code): the target module, src/features/measurements/*, is
// RN/Node-style TypeScript with extensionless relative imports — sloppy mode
// lets Deno resolve those without touching that source's import style.

import {
  evaluateFixture, aggregate, suggestCalibration, CALIBRATABLE_KEYS,
  type Fixture,
} from '../../src/features/measurements/accuracyEval';

const CALIBRATE = Deno.args.includes('--calibrate');

// ─── Load fixtures ─────────────────────────────────────────────────────────

const fixturesDir = new URL('./fixtures/', import.meta.url);

async function loadFixtures(): Promise<Fixture[]> {
  const fixtures: Fixture[] = [];
  let entries: Deno.DirEntry[] = [];
  try {
    for await (const entry of Deno.readDir(fixturesDir)) entries.push(entry);
  } catch {
    return fixtures; // fixtures/ missing entirely — treat as zero fixtures
  }

  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith('.json')) continue;
    const fileUrl = new URL(entry.name, fixturesDir);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await Deno.readTextFile(fileUrl));
    } catch (err) {
      console.warn(`[measure-eval] skipping ${entry.name} — invalid JSON (${err instanceof Error ? err.message : err})`);
      continue;
    }
    const fx = parsed as Fixture;
    if (!fx || typeof fx.subjectId !== 'string') {
      console.warn(`[measure-eval] skipping ${entry.name} — missing subjectId`);
      continue;
    }
    if (fx.subjectId.startsWith('example')) continue; // template file — never scored
    fixtures.push(fx);
  }
  return fixtures;
}

const fixtures = await loadFixtures();

if (fixtures.length === 0) {
  console.log('[measure-eval] no fixtures yet — see fixtures/README.md for the schema and how to capture one.');
  Deno.exit(0);
}

// ─── Evaluate + aggregate ──────────────────────────────────────────────────

const results = fixtures.map((fx) => evaluateFixture(fx));
const agg = aggregate(results);

// Side (profile) depth-capture pass, 2026-07 — surface how many loaded
// fixtures actually carry a `side` block, since that's what's needed before
// `superellipseN`/`sideDepthWidthRatioMin`/`Max` can be calibrated at all.
const sideCount = fixtures.filter((f) => f.side).length;
console.log(
  `[measure-eval] ${fixtures.length} fixture(s), ${sideCount} with side/profile data: ` +
  `${fixtures.map((f) => f.subjectId).join(', ')}\n`,
);

console.log('Field                     n   bias(cm)   MAE(cm)   RMSE(cm)   ×mult    +offset');
console.log('------------------------  --  ---------  --------  ---------  -------  -------');
const fieldOrder = [
  'body_bust', 'body_waist', 'body_hip', 'body_inseam',
  'body_shoulder_width', 'body_sleeve_length', 'body_upper_body_length',
];
for (const field of fieldOrder) {
  const stat = agg.perField[field];
  if (!stat) continue;
  console.log(
    `${field.padEnd(24)}  ${String(stat.n).padStart(2)}  ${stat.bias.toFixed(2).padStart(9)}  ` +
    `${stat.mae.toFixed(2).padStart(8)}  ${stat.rmse.toFixed(2).padStart(9)}  ` +
    `${stat.suggestMultiplier.toFixed(3).padStart(7)}  ${stat.suggestOffset.toFixed(2).padStart(7)}`,
  );
}
if (Object.keys(agg.perField).length === 0) {
  console.log('(no field has both a prediction and a groundTruth value yet)');
}

console.log(
  `\nBody-shape accuracy: ${agg.shapeAccuracy != null ? `${(agg.shapeAccuracy * 100).toFixed(0)}%` : 'n/a (no fixture has a full bust+waist+hip truth)'}` +
  ` · subjects: ${agg.nSubjects}`,
);

// ─── Optional calibration search ───────────────────────────────────────────

if (CALIBRATE) {
  console.log('\n--calibrate: coordinate-descent search over the landmark-space tunables\n');
  const { tunables, beforeMae, afterMae } = suggestCalibration(fixtures, CALIBRATABLE_KEYS);
  console.log(`Weighted MAE before: ${beforeMae.toFixed(3)} cm  →  after: ${afterMae.toFixed(3)} cm`);
  console.log('\nSuggested tunables (paste into an EstimateInputs.tunables override to try it):');
  console.log(JSON.stringify(tunables, null, 2));
}
