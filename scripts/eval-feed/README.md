# eval-feed — offline outfit-engine eval harness

Runs the `generate-outfits` engine (pure Deno TS, no DB/network) against a
**fixed fixture wardrobe** (`fixture.ts`) and emits a deterministic top-10 feed
snapshot. Two engine versions can then be compared with a blind LLM (or human)
judge.

This harness deliberately skips: DB reads, LLM curation, and the daily
shuffle — it exercises only the rule-engine pipeline (enrichment → style
filter → candidate generation → ranking → quality gate → top 10).

## Files

- `fixture.ts` — exports `PROFILES`, a map of named fixture wardrobes + user
  profiles. Five today, each FOR a different reachable code path:
  - `smartcasual` (30 items, smart-casual/minimalist, neutral palette — the
    default) — the general-purpose baseline; also the only one of the
    original three with any garment `measurements`, so it's the minimum bar
    for exercising `scoreOutfitFit`'s real (non-0.5-default) path.
  - `streetwear` (25 items, black/white/gray + red/green/blue accents) — for
    pattern-mixing (up to 2 "bold" patterns) and the HOODIE outerwear-slot
    path, neither reachable from `smartcasual`.
  - `resort` (20 items, white/cream/beige/blue/tan/khaki/coral/terracotta,
    linen/cotton/canvas only) — for the `PATTERN_FRIENDLY_STYLES` print-led
    styles (floral/tropical) and their 2-bold-pattern combos.
  - `measured` (24 items, smartcasual style, `BODY_MEASUREMENTS`
    body_shape='rectangle') — for `scoreOutfitFit`'s full [0,1] range (a
    deliberate spread of near-ideal/mediocre/mislabelled-cut items, unlike
    `smartcasual`'s uniformly-good ones) AND the guessed-fit path: 8 of the
    24 items carry no `fit` field, so `deriveFitWithProvenance` guesses and
    `provenance.fit` comes back `false`, exercising `shiftThresholds`'s
    `GUESS_WIDENING` (previously unreachable — every item everywhere else
    declares an explicit `fit`). Also seeds shoe `shoe_size`/`shoe_width` and
    an accessory `waist` measurement for the known (still-open) shoes/
    accessories measurement-scoring gap — inert today, ready when a mapping
    lands.
  - `measured-goal` — same wardrobe as `measured`, only the profile differs:
    sets `shapeGoal: 'hourglass'` (confirmed reachable for a 'rectangle'
    body_shape via `isShapeGoalReachable`, silhouette.ts), so
    `ranking.ts`'s `shapeGoalDelta` — previously unreachable, no fixture set
    a `shapeGoal` — actually swings instead of being a permanent no-op.
    `run.ts` threads `PROFILE.shapeGoal` into `ctx.shapeGoal` for this to
    work; the other four profiles don't set the field, so `ctx.shapeGoal`
    stays `undefined` for them (`shapeGoalDelta`'s own no-op condition) —
    zero behavior change.
  - `onepiece` (23 items: 8 dresses / 8 shoes / 5 outerwear / 2 accessories,
    smartcasual style, no tops/bottoms at all) — added 2026-08-12 to close
    the harness's other blind spot: none of the other five fixtures contains
    a single DRESS/JUMPSUIT/OVERALLS/GOWN item, so `generateOnepieceCandidates`
    in `generation.ts` was completely unreachable from this harness. Dresses
    (8) × shoes (8) = 64 deliberately EXCEEDS `ONEPIECE_CAP` (60) in the bare
    cross product alone — the exact precondition that starved the pre-fix
    outerwear loop (it ran AFTER the bare double loop, which `return`ed on
    hitting the cap before the outerwear loop ever started). No top/bottom
    items are included on purpose: every formula pool in `getFormulaPools`
    and the `generateFallback` path both require tops AND bottoms, so with
    neither present, `generateCandidates`' output is *exactly*
    `generateOnepieceCandidates`' output — isolating the one-piece path
    completely, so any outerwear-bearing outfit in a run against this
    fixture can only have come from there.
  - `layering` (12 items, smartcasual style) — added 2026-08-12 to measure
    the `deriveCanLayer` fix for regular-fit SHIRTs in light fabrics (see
    `plan.md` 2026-08-12 entry). 2 base TEEs (light fabric, `layerRole:
    'base'`); 2 SHIRTs with a DECLARED `fit: 'regular'` in a light fabric
    (linen, cotton oxford) — expected to flip canLayer false→true under the
    fix; 1 SHIRT with no stored `fit` and a name free of any fit keyword —
    `deriveFitWithProvenance` guesses `TYPE_DEFAULT_FIT`'s 'regular' with
    `real: false`, so it must stay canLayer:false before AND after (the
    provenance gate's whole point); and 1 declared-regular HENLEY — proves
    the fix's SHIRT-only scope (a henley's short neck placket can't open like
    a shirt's full button front), so it must stay canLayer:false before AND
    after too, even with a real fit signal. Bottoms/shoes/accessory items
    reuse color/material/fit combos already proven to clear the smartcasual
    style filter in `SMARTCASUAL_WARDROBE`, so the fixture spends its size on
    the layering path, not re-proving the filter.

  Do not edit `smartcasual` / `streetwear` / `resort` casually — these are
  the baselines every snapshot is compared against; `measured` /
  `measured-goal` / `onepiece` / `layering` are additive and were added
  specifically so those three never need to be touched to cover new ground.
  `WARDROBE` / `PROFILE` remain exported as aliases for `PROFILES.smartcasual`
  for backward compatibility.
- `run.ts` — runs the pipeline against a given engine directory, writes a
  snapshot JSON, and prints a human-readable table.
- `judge.ts` — blind A/B judge for two snapshots (Gemini, or a manual prompt
  if no API key).

## 1. Run the baseline

```sh
deno run --allow-read --allow-write scripts/eval-feed/run.ts \
  --engine supabase/functions/generate-outfits/engine \
  --out scratchpad/baseline.json
```

## 2. Run a candidate engine (e.g. a modified copy)

```sh
deno run --allow-read --allow-write scripts/eval-feed/run.ts \
  --engine /path/to/candidate/engine \
  --out scratchpad/candidate.json
```

`--engine` accepts an absolute or relative path (Windows backslash paths are
fine too) to a directory containing `enrichment.ts`, `filtering.ts`,
`generation.ts`, and `ranking.ts`. The seed is fixed
(`eval:fixed-seed-001`) inside `run.ts`, so re-running against the same engine
directory always produces byte-identical JSON — this is what makes the
snapshot diff meaningful across engine changes.

`--profile <name>` selects which fixture wardrobe + user profile to run
(`smartcasual` | `streetwear` | `resort` | `measured` | `measured-goal` |
`onepiece` | `layering`, see `fixture.ts`). Defaults to `smartcasual` if omitted:

```sh
deno run --allow-read --allow-write scripts/eval-feed/run.ts \
  --engine supabase/functions/generate-outfits/engine \
  --profile streetwear \
  --out scratchpad/streetwear.json
```

## 3. Judge the two snapshots blind

```sh
# With a Gemini key (runs 3 trials, alternating which snapshot is "Feed X"
# vs "Feed Y" to cancel out positional bias, then prints a majority verdict):
GOOGLE_API_KEY=... deno run --allow-read --allow-net --allow-env \
  scripts/eval-feed/judge.ts scratchpad/baseline.json scratchpad/candidate.json

# Without a key: writes the blind prompt to a file (or stdout) for a human /
# separate LLM session to judge manually — no engine identity or scores are
# ever shown to the judge, only formula + item names + colors.
deno run --allow-read --allow-net --allow-env \
  scripts/eval-feed/judge.ts scratchpad/baseline.json scratchpad/candidate.json \
  --out scratchpad/judge-prompt.txt
```

## Notes on permissions

The feature spec's CLI examples list `--allow-read` for `run.ts` and
`--allow-net --allow-env` for `judge.ts`. In practice `run.ts` also needs
`--allow-write` (it writes the snapshot to `--out`), and `judge.ts` also needs
`--allow-read` (it reads the two snapshot files) plus `--allow-write` only if
you pass `--out`. The commands above use the permissions actually required.

## Determinism

`run.ts` always passes a constant seed (`eval:fixed-seed-001`) to
`generateCandidates` / `generateHeroCandidates`, so `Math.random` is never
used as a fallback. Running `run.ts` twice against the same engine directory
must produce byte-identical snapshot JSON — verify with:

```sh
diff <(deno run --allow-read --allow-write scripts/eval-feed/run.ts --engine <dir> --out /dev/stdout 2>/dev/null) \
     <(deno run --allow-read --allow-write scripts/eval-feed/run.ts --engine <dir> --out /dev/stdout 2>/dev/null)
```

(or just run twice to two files and `diff` them).
