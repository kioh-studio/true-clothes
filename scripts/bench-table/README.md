# bench-table

Consolidated real-vs-machine benchmark (current tunables, no calibration). Writes a per-subject CSV (keep it OUTSIDE the repo: BodyM is CC BY-NC) and `reports/benchmark-all.md` (aggregates only).

```sh
S=C:/Users/PC/AppData/Local/Temp/claude/9eab97e6e9aa9014/2170bd1e-d954-447b-bf8c-807f7603bced/scratchpad
mkdir -p $S/bench
deno run -A --node-modules-dir=none --sloppy-imports scripts/bench-table/build.ts \
  --csv=$S/bench/per_subject.csv --md=reports/benchmark-all.md \
  "BodyM=$S/bodym/derived/base" \
  "synth-set1 (bad framing)=$S/replay-out-set1"
# later: add "synth-set2=$S/replay-out-set2"
```

A `name=dir` arg is BodyM-style if the dir holds `train/testA/testB.json`, otherwise a set of `body_*.json` fixtures.
