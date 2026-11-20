# bodym-eval

Benchmark + calibration of `keypointsToMeasurements` on BodyM (CC BY-NC 4.0 — **internal benchmarking only; never copy the data, masks, CSVs or derived fixtures into the repo**). Results: `reports/bodym-benchmark.md`.

Keep everything in one scratch dir outside the repo, e.g. `D=/path/to/bodym`. Run from the repo root (Deno 2, `--node-modules-dir=none` so no `node_modules` is touched; `npm:pngjs` is fetched into Deno's cache).

```sh
# 1. data (~70 MB, masks only; CSVs are tiny)
D=/path/to/bodym; mkdir -p $D/raw
aws s3 sync --no-sign-request s3://amazon-bodym/ $D/raw/ --exclude "*" --include "*/mask/*" --include "*/mask_left/*"
for s in train testA testB; do for f in hwg_metadata measurements subject_to_photo_map; do
  curl -s -o $D/${s}_$f.csv https://amazon-bodym.s3.amazonaws.com/$s/$f.csv; done; done

# 2. masks -> fixture v2 JSON in $D/derived/<tag>/  (~3 min for all splits)
DENO="deno run -A --node-modules-dir=none --sloppy-imports"
$DENO scripts/bodym-eval/convert.ts $D --tag=base
#   sensitivity variants: --S=hipDownLegFraction=0.1 (silhouetteMath S override), --F=acromion=0.83 (pseudo-keypoint fraction),
#   --splits=testA,testB, --max-per-subject=N

# 3. benchmark with the CURRENT constants (raw/fused x front-only/front+side, testA + testB)
$DENO scripts/bodym-eval/run.ts $D --tag=base

# 4. calibrate on TRAIN (weighted coordinate descent), re-score tests
$DENO scripts/bodym-eval/run.ts $D --calibrate=side  --no-scale --out=$D/res_side.json
$DENO scripts/bodym-eval/run.ts $D --calibrate=front --no-scale --out=$D/res_front.json
#   evaluate a tunables file:  --tunables=file.json
```

Fixtures carry a top-level `weight` (fixture v2 extension) and `meta`, so they can also be scored with `scripts/measure-eval/run.ts --dir <dir>/derived/base --fuse` once that runner supports it.

Weights are a **body-size proxy for "Asian-like"** (BodyM's CSVs have no ethnicity): density ratio of NHANES Asian (height, BMI | sex) over a Gaussian fitted to BodyM-train, clipped [0.2, 5], divided by the subject's photo count.
