# measure-eval fixtures

A **fixture** is one captured on-device body scan (raw MoveNet keypoints +
segmentation-mask contour widths + whatever inputs the user had at scan
time) paired with the SAME subject's real tape-measure numbers. The harness
replays the captured scan offline through the exact same
`keypointsToMeasurements` the app uses and diffs the prediction against the
tape truth — no re-scanning needed to try a different tuning.

**Honest note up front:** this measures accuracy against ground truth.
Nothing is validated until fixtures with real tape measurements exist here —
an empty `fixtures/` (aside from `example.json`) means the harness has
nothing to say yet. It also cannot re-tune the segmentation-mask BAND
placement (`S` in `../../src/features/measurements/silhouetteMath.ts` — where
the shoulder/chest/waist/hip rows are scanned on the mask): a fixture only
stores the already-extracted `SilhouetteWidths`, not the raw mask, so the
harness can't re-run that scan. Only the landmark-space constants consumed
AFTER the widths are known (`MeasurementTunables` in `landmarksToMeasurements.ts`)
are calibratable here.

## Schema

```json
{
  "subjectId": "khoi-01",
  "capturedAt": "2026-07-06",
  "inputs": { "heightCm": 176, "weightKg": 76, "sex": "male", "ageYears": 33 },
  "keypoints": [ { "name": "nose", "x": 0.5, "y": 0.08, "score": 0.95 }, "...17 total" ],
  "silhouette": { "shoulderU": 0.34, "chestU": 0.30, "waistU": 0.26, "hipU": 0.31 },
  "groundTruth": { "body_shoulder_width": 45, "body_bust": 96, "body_waist": 82, "body_hip": 98, "body_inseam": 80, "body_upper_body_length": 46, "body_sleeve_length": 62 }
}
```

- `subjectId` — any string. **Must NOT start with `"example"`** — the runner
  skips any fixture whose `subjectId` starts with that prefix (that's how it
  skips this directory's own `example.json` template).
- `capturedAt` — informational only, not read by the evaluator.
- `inputs.heightCm` — required (same as the app: height is the scale
  reference, no height ⇒ no estimate). `weightKg`/`sex`/`ageYears` optional,
  same semantics as `EstimateInputs` in `landmarksToMeasurements.ts`.
- `keypoints` — the 17 MoveNet keypoints EXACTLY as captured (letterboxed-
  square normalised space — the `kps` argument to `keypointsToMeasurements`,
  not the display-space ones used for the on-screen overlay).
- `silhouette` — the contour widths from the segmentation pass, or `null`/
  omitted if the scan had none (the estimate then falls back to the
  keypoint-span heuristics, same as in the app).
- `groundTruth` — tape-measure numbers in cm. **Every field is optional** —
  only fill in what you actually measured with a tape; the harness scores
  only the fields present in both the prediction and the ground truth.

## How to capture a fixture on a device

1. Run a dev build and go through Measurements → AI scan
   (`app/measurements-scan.tsx`) as normal.
2. On a successful capture, a `__DEV__`-only line is logged to the Metro
   console: `[MEASURE_EVAL_JSON]{...}` — the full fixture payload (keypoints,
   silhouette widths, inputs) with `groundTruth: {}` left empty. It's also
   written to a file on-device
   (`${FileSystem.documentDirectory}measure-eval-<n>.json`, logged as
   `[MEASURE_EVAL] wrote <path>`) in case pulling it off-device is easier
   than copying out of the Metro log.
3. Grab either the JSON from the log line or the written file, and
   immediately take the REAL tape measurements of the same subject (shoulder,
   bust, waist, hip, inseam, torso, sleeve — whatever you can measure).
4. Fill those into `groundTruth`, give it a real `subjectId`
   (e.g. `"khoi-01"`), and drop the file into this directory as
   `<subjectId>.json`.
5. Repeat for a few subjects — at least 3 different bodies is the practical
   minimum before `--calibrate`'s suggestions are worth trusting over the
   current defaults (see `backlog.md` §B).

## How to run

```sh
npm run measure-eval
```

Prints a per-field table (n, bias, MAE, RMSE, suggested ×multiplier and
+offset — the linear correction that would zero the mean bias for that field
alone) plus body-shape accuracy (bust/waist/hip → `computeBodyShape`) and the
fixture count. With zero fixtures (aside from `example.json`, which is always
skipped) it prints a one-line "no fixtures yet" message instead of an empty
table.

```sh
npm run measure-eval -- --calibrate
```

Additionally runs a coordinate-descent search over the standard calibratable
tunable list (`CALIBRATABLE_KEYS` in `../../src/features/measurements/accuracyEval.ts`)
and prints the weighted MAE before/after plus the suggested `tunables` block,
ready to paste into an `EstimateInputs.tunables` override to try it (or into
`K` in `landmarksToMeasurements.ts` once you're confident in it — see the
CALIBRATION-PENDING comments there for which constants this covers).

The runner is a Deno script (matching `scripts/eval-feed/run.ts`'s mechanism),
invoked with `--sloppy-imports` in addition to `--allow-read`: unlike
eval-feed's Deno-native engine target, `src/features/measurements/*` is
RN/Node-style TypeScript with extensionless relative imports, and
`--sloppy-imports` lets Deno resolve those without changing that source's
import style.
