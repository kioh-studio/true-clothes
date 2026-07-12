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
  profiles: `smartcasual` (30 items, smart-casual/minimalist, neutral palette
  — the default) and `streetwear` (25 items, black/white/gray + red/green/blue
  accents, includes HOODIEs and pattern-mixing pieces so the harness can
  exercise those code paths). Do not edit casually — these are the baselines
  every snapshot is compared against. `WARDROBE` / `PROFILE` remain exported
  as aliases for `PROFILES.smartcasual` for backward compatibility.
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
(`smartcasual` or `streetwear`, see `fixture.ts`). Defaults to `smartcasual`
if omitted:

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
