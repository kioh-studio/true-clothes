# BodyM benchmark + calibration of the MIEN body-scan pipeline

Date 2026-11-19. Scripts: `scripts/bodym-eval/` (README has the exact commands). All BodyM data and derived fixtures live outside the repo.

## TL;DR

- The pipeline rejected **0 of 8,978** BodyM photo pairs (train 6,134 / testA 1,684 / testB 1,160), and the converter skipped none. Rejection is not the issue.
- **Waist and hip** (the only girths this benchmark can judge) are at MAE ~3-8 cm raw and ~2-5 cm fused with the current constants. Calibration on train does **not** transfer reliably between testA and testB (waist bias differs by ~4 cm between the two splits), so I recommend **changing no tunables** from this benchmark (see "Recommended values").
- **Bust and front shoulder width cannot be benchmarked on BodyM.** Subjects stand in an A-pose, their arms merge with the torso mask at chest and shoulder rows, and the contour scan reads the arms: bust +36 to +56 cm, shoulder +9.4 to +9.8 cm. This is a protocol mismatch with the app, but also a warning: if real users hold arms away from the body, the app will over-read in the same way.
- Inseam, torso length and sleeve are functions of the invented keypoints only (low validity); torso is also a definition mismatch (-20 cm).
- The segmentation band constants `S` are **not** the dominant error (changing them moves waist/hip MAE by under 0.5 cm, one exception below).

## Licence and data handling

BodyM (Amazon, arXiv 2210.05667) is CC BY-NC 4.0. anh Khoi accepted internal benchmarking use only. Nothing from BodyM (masks, CSVs, per-subject fixtures) is in the repo; only scripts and this aggregate report. Treat any constants derived from it as derived from non-commercial data and re-check the licence before shipping them commercially.

## Data layout (verified)

`s3://amazon-bodym` (no-sign-request): `{train,testA,testB}/{hwg_metadata.csv, measurements.csv, subject_to_photo_map.csv, mask/<photo_id>.png, mask_left/<photo_id>.png}`. Masks only (no RGB), 720x960 binary 8-bit PNG, about 6 KB each, about 70 MB for everything. Front and left masks share the same `photo_id`. `hwg_metadata`: subject_id, gender, height_cm, weight_kg. `measurements.csv`: the 14 values in cm. **No ethnicity or age column** (the paper reports 40% White / 30% Asian / 14% Black / 15% Other per individual, but it is not in the CSVs). Subjects: train 2,018, testA 87, testB 400. Photos per subject: about 3 (train), about 19 (testA), about 3 (testB). Every photo is scored, but each subject carries a total weight of 1 per split (weight divided by its photo count).

## Method

1. **Converter** (`convert.ts`, Deno): PNG padded to a 960 square, 2x box-downsampled to a 480x480 float mask (graded edges, like the app's MODNet mask). Widths come from the app's `extractWidths`, the scale extent from `maskVerticalExtent` with the app's probe scheme, side depths from `extractSideDepths` driven by the front row fractions. The side view gets its own scale via `estimatePersonUnitH` (same as `evaluateFixture`). Predictions use the app's `keypointsToMeasurements`, then `demographicPrior` + `fuseWithPrior` (age unknown, default 30). No hand erasure on the side mask (no wrist keypoints).
2. **Pseudo-keypoints (the main limitation).** Crown and sole from the mask; y from textbook stature fractions (nose 0.936, acromion 0.818, hip joint 0.52, ankle 0.039); x = median mask midpoint over the torso rows, with constant stature-fraction spans (shoulder 0.23 H, hip 0.10 H). All score 1; no heel, elbow or wrist. They sit in one `F` block in `convert.ts` with a `ponytail:` note. Consequences: (a) the keypoint shoulder term is a constant, so shoulder is half-informative at best; (b) inseam and torso are pure functions of height and my fractions; (c) my nose-to-ankle gap (0.897 H) vs `noseAnkleHeightFraction` 0.88 is a built-in ~2% scale mismatch; (d) chest/waist/hip band placement inherits textbook proportions. **Sleeve is not benchmarked.**
3. **Ground-truth mapping**: chest -> bust, waist -> waist, hip -> hip, shoulder-breadth -> shoulder, leg-length -> inseam, shoulder-to-crotch -> upper_body_length, arm-length -> sleeve (unused).
4. **Asian-like weights (PRIMARY metric; proxy).** BodyM has no ethnicity field, so each subject is weighted by the density ratio p_asian(height, BMI | sex) / p_bodym(height, BMI | sex), clipped to [0.2, 5]. p_asian is a 2D Gaussian from NHANES 2017-18 + 2021-23 adults 18-65, `RIDRETH3==6` (male n=430, 170.7 cm / BMI 26.7, SD 7.1 / 4.8; female n=505, 156.9 cm / BMI 25.2, SD 5.9 / 5.0). p_bodym is a 2D Gaussian fitted to BodyM-train per sex. Effective sample size: train 1,039 of 2,018 subjects, testA 46 of 87, testB 206 of 400; 12 to 17% of subjects sit at the 0.2 floor. **This is a proxy for body size, not ethnicity**: it cannot capture Asian-specific proportions (leg/torso ratio, depth/width ratios, shoulder breadth), it down-weights Asian subjects at Western body sizes and up-weights small non-Asian ones. Tables show weighted MAE / weighted bias, with the unweighted per-subject MAE in brackets. Weighted and unweighted numbers are mostly within 0.5 cm, so the proxy changes little.
5. **Calibration**: weighted coordinate descent (same scheme as `suggestCalibration`: grid 0.6-1.4 x default, 17 points, 3 passes) on **train only**, objective = weighted MAE of waist + hip. Bust and shoulder are excluded (the A-pose arm artefact would be absorbed by the tunables), as are tunables that are no-ops when a silhouette exists (waistBlend*, waistScale, hipWidthCorrection) and the inseam/torso tunables. Variants: "shape-only" (`--no-scale`: depth ratios and superellipse N only) and "+scale levers" (also `noseAnkleHeightFraction`, `maskExtentFudge`); and two fit modes (objective computed front-only, or front+side).

## Definition mismatches (BodyM vs the app)

The measurements were taken on SMPL-registered meshes in a canonical A-pose; I could not extract the landmark definitions from the paper text, so what follows is inferred from the numbers and is **not verified**.

| BodyM | App | Evidence / note |
|---|---|---|
| waist girth | body_waist = narrowest contour row | Probably a mesh-defined (navel/natural) waist, larger than the narrowest row. Raw bias is negative (-2.6 to -7.8 cm), which fits. It differs by ~4 cm between testA and testB, so part of it is population. |
| shoulder-breadth | contour/keypoint blend | A-pose arms inflate the contour (+9.4 to +9.8 cm). |
| chest girth | bust from the chest row | Same A-pose artefact; bust unusable. |
| shoulder-to-crotch (~60 cm, ~0.37 H) | upper_body_length = 0.85 x shoulder-to-hip (neck base to natural waist) | Different measure: constant -20 cm. Do not calibrate. |
| leg-length (~72 cm) | inseam (hip joint to ankle x 0.95) | Similar magnitude; error is dominated by my fractions. |
| arm-length | sleeve | Not evaluated. |

## Results

Cell format: weighted MAE / weighted bias in cm, [unweighted MAE]. front-only / front+side = whether the side depth is used; raw / fused = without / with `fuseWithPrior`. Calibrated = fit on train only, scored on the held-out split; "shape-only" = `--no-scale` fit, "+scale levers" = fit that also moved `noseAnkleHeightFraction`. Front-only rows use the front-mode fit, front+side rows the side-mode fit. Bias sign: positive = reads too large.

### Waist

| split | config | CURRENT | calibrated (shape-only) | calibrated (+scale levers) |
|---|---|---|---|---|
| testA | front-only raw | 4.61 / -3.85 [4.93] | 4.78 / +3.70 [4.42] | 4.24 / +3.16 [4.02] |
| testA | front+side raw | 4.16 / -2.62 [4.31] | 4.49 / +3.94 [4.80] | 3.45 / +2.21 [3.80] |
| testA | front-only fused | 4.21 / -3.62 [4.45] | 3.43 / +1.80 [3.05] | 3.10 / +1.41 [2.89] |
| testA | front+side fused | 4.00 / -2.68 [4.10] | 3.75 / +3.07 [4.02] | 2.97 / +1.56 [3.27] |
| testB | front-only raw | 8.50 / -7.83 [8.02] | 5.25 / -0.73 [4.70] | 5.08 / -0.82 [4.63] |
| testB | front+side raw | 6.88 / -5.33 [6.32] | 5.39 / +1.54 [4.98] | 5.22 / -0.26 [4.73] |
| testB | front-only fused | 7.49 / -7.07 [7.05] | 4.42 / -1.83 [3.96] | 4.40 / -1.89 [4.02] |
| testB | front+side fused | 6.56 / -5.37 [6.01] | 4.88 / +0.81 [4.45] | 4.84 / -0.81 [4.34] |

### Hip

| split | config | CURRENT | calibrated (shape-only) | calibrated (+scale levers) |
|---|---|---|---|---|
| testA | front-only raw | 3.37 / +1.52 [3.51] | 2.97 / -0.17 [3.19] | 3.11 / +0.60 [3.30] |
| testA | front+side raw | 4.11 / +1.08 [4.07] | 4.10 / +1.07 [4.06] | 4.27 / +2.09 [4.22] |
| testA | front-only fused | 1.75 / -0.12 [2.11] | 1.84 / -0.84 [2.18] | 1.84 / -0.53 [2.18] |
| testA | front+side fused | 3.08 / +0.38 [3.12] | 3.07 / +0.37 [3.10] | 3.16 / +1.11 [3.21] |
| testB | front-only raw | 4.35 / -0.80 [4.34] | 4.87 / -2.57 [4.71] | 4.62 / -1.81 [4.59] |
| testB | front+side raw | 5.63 / -1.38 [5.10] | 5.58 / -1.49 [5.05] | 5.46 / -0.49 [5.05] |
| testB | front-only fused | 3.45 / -2.04 [3.18] | 3.78 / -2.92 [3.42] | 3.65 / -2.55 [3.38] |
| testB | front+side fused | 4.88 / -1.92 [4.24] | 4.85 / -2.01 [4.19] | 4.66 / -1.28 [4.11] |

### Bust, shoulder, inseam, torso (CURRENT constants only; not calibrated)

| field | split | front-only raw | front+side raw | notes |
|---|---|---|---|---|
| bust | testA | 56.45 / +55.92 | 40.71 / +40.52 | A-pose arms; only 717 (front) / 1,353 (side) of 1,684 predictions survive the 60-160 sane-range clamp, so even these MAEs are survivor-biased and understated |
| bust | testB | 53.82 / +53.82 | 36.07 / +36.07 | 579 / 957 of 1,160 survive |
| shoulder | testA | 9.81 / +9.81 | same | A-pose arms; with `shoulderBlendContour=1` (contour only) +12.7 |
| shoulder | testB | 9.41 / +9.41 | same | contour only: +12.0 |
| inseam | testA / testB | 1.99 / 2.27 | same | low validity (stature fractions) |
| upper_body_length | testA / testB | 19.97 / 20.27 | same | definition mismatch |

Fused numbers for bust are identical to raw because the prior treats the scan as an outlier and keeps it (the fuse gate is 3 sigma).

### Front-only vs front+side

Side depth helps waist (testA 4.61 -> 4.16, testB 8.50 -> 6.88 raw) but **hurts hip** (testA 3.37 -> 4.11, testB 4.35 -> 5.63 raw; fused 1.75 -> 3.08 and 3.45 -> 4.88). Likely causes: no hand erasure on the side mask (A-pose hands hang at hip level), and the pseudo hip-row registration. On real device data the hand-erase step exists, so do not read this as "side view hurts hip" without a real-scan check; but it is a reason not to trust the side-mode hipDepthRatio fit.

### Raw vs fused

`fuseWithPrior` is the biggest single improvement: waist testA 4.61 -> 4.21, testB 8.50 -> 7.49 (front-only); hip testA 3.37 -> 1.75, testB 4.35 -> 3.45. It reduces the damage of the waist-definition bias but does not remove it (the prior's own waist offset was sized for the "narrowest waist" convention).

### Rejections and omissions

Rejected photos (null estimate): **0 / 8,978** in every configuration (all keypoints are synthetic with score 1, so the keypoint-quality gates cannot fire; this says nothing about real-camera rejection rates). Fields omitted by the sane-range clamps: bust 967 (testA front-only), 331 (testA front+side), 581 / 203 (testB); waist 0-2; hip 0-1; the rest 0.

### Segmentation band / pseudo-keypoint sensitivity (front+side raw, w-MAE / bias, CURRENT tunables)

| variant | testA waist | testA hip | testB waist | testB hip |
|---|---|---|---|---|
| base | 4.16/-2.62 | 4.11/+1.08 | 6.88/-5.33 | 5.63/-1.38 |
| `S.hipDownLegFraction` 0.10 (default 0.25) | 4.16/-2.62 | 3.76/-0.62 | 6.88/-5.33 | 5.42/-1.52 |
| `S.hipDownLegFraction` 0.40 | 4.16/-2.62 | 4.19/+1.11 | 6.88/-5.33 | 5.66/-1.31 |
| waist band 0.35-0.75 (default 0.45-0.85) | 4.22/-2.02 | 4.11/+1.08 | 7.00/-5.11 | 5.63/-1.38 |
| waist band 0.55-0.95 | 4.15/-2.72 | 4.11/+1.08 | 6.70/-4.94 | 5.63/-1.38 |
| acromion fraction 0.830 (0.818) | 4.16/-2.62 | 4.11/+1.08 | 6.89/-5.34 | 5.64/-1.39 |
| acromion 0.806 | 4.15/-2.63 | 4.11/+1.08 | 6.87/-5.31 | 5.63/-1.38 |
| hip-joint fraction 0.54 (0.52) | 4.15/-2.42 | 4.07/+1.00 | 6.87/-5.24 | 5.61/-1.36 |
| hip-joint fraction 0.50 | 4.14/-2.66 | 4.14/+1.11 | 6.86/-5.30 | 5.67/-1.44 |

`S` is not the dominant error. Only the seat band depth (`hipDownLegFraction` 0.25 -> 0.10) moves hip, by 0.3-0.4 cm; that is within the noise of this benchmark, and in the app the hip band also catches the A-pose-free real seat, so I would not change it without device data. The pseudo-keypoint fractions barely move waist/hip (the girth bands are placed by torso fraction), which is reassuring for the girths, though it says nothing about the stature-fraction-only fields.

## Calibration (train only, weighted waist + hip objective)

Train weighted MAE (waist+hip): front mode 5.81 -> 4.04 (shape-only) / 4.01 (+scale); side mode 5.31 -> 4.37 / 4.29.

| tunable | default | front-mode fit | side-mode fit | flag / trust |
|---|---|---|---|---|
| waistDepthRatio | 0.72 | 0.90 (x1.25) | 0.72 (x1.0) | >30%-ish and the two modes disagree. Not trusted; it mostly absorbs the waist-definition bias (BodyM waist is larger than the narrowest row). |
| hipDepthRatio | 0.70 | 0.70 | 0.42 (x0.6, **AT BOUND**) | Side-mode value is an artefact (only matters where the side-depth gate fails). Reject. |
| superellipseNWaist | 2.15 | 2.15 | 2.365 (x1.10) | Plausible direction (reports/anthro-fit-ansur.md has ANSUR n 2.24), but 10% and unstable. Weak. |
| superellipseNHip | 2.10 | 1.995 (x0.95) | 2.10 | Within 5%; indistinguishable from noise. |
| noseAnkleHeightFraction (+scale fit only) | 0.88 | 1.012 (x1.15) | 1.012 | Scale lever compensating the pseudo-keypoint nose/ankle fractions. **Do not use.** |
| maskExtentFudge (+scale fit only) | 1.02 | 1.02 | 1.02 | Unchanged. |

Not calibrated by design: chestDepthRatio, superellipseNChest, chestFromShoulder, shoulderBlendContour, kpShoulderFactor, contourShoulderInset (bust/shoulder artefact), inseamProjectionFactor, torsoFromShoulderHip (synthetic keypoints / definition mismatch), waistBlend*, waistScale, hipWidthCorrection (no-ops when a silhouette exists).

## Recommended values

**No tunable change.** Reasons: (1) the train-fitted values do not reproduce on both held-out splits (waist: testA front-only raw gets worse, 4.61 -> 4.78, while testB improves 8.50 -> 5.25; the bias flips sign on testA); (2) the side-mode fit hits a bound; (3) the two fit modes disagree on every depth/shape tunable; (4) the largest effects come from the waist-definition mismatch and the population shift, not from shape constants; (5) the pseudo-keypoint scale artefact leaks into any scale lever. If anh Khoi wants one directional hint to verify on tape-measured fixtures: BodyM's waist reads ~3-8 cm larger than the narrowest-row waist, so the pipeline's "narrowest waist" convention under-reads against a navel-type waist, and `WAIST_OFFSET_CM` in `demographicPrior.ts` (which subtracts 3.5/6.5 cm from the prior to match the narrowest convention) is consistent with that; that offset deserves a check once VN/tape data exist, not a BodyM-based edit.

## Surprises and caveats

- A-pose: arms merging with the torso make bust and shoulder unbenchmarkable; the app's capture instructions should keep arms clearly away from the torso, or the centerline-run scan should be checked against a hands-by-the-sides pose.
- testA and testB are different populations (waist bias -3.9 vs -7.8 cm; testA is 87 subjects with ~19 augmented photos each, so its effective sample is small). Any single-split calibration is brittle.
- Weights are a body-size proxy, not ethnicity; the weighted and unweighted results differ by under ~0.5 cm, so Asian-like emphasis does not change any conclusion here.
- The benchmark validates the **mask-to-girth** half of the pipeline (width scan, ellipse/superellipse, depth source, fusion), not BlazePose, not real-keypoint scale error, not arm/sleeve.
- BodyM masks come from a semantic segmenter on a studio setup (5.5-6.5 ft, tight clothing); real users wear looser clothes, so expect larger errors on device.
- Calibrated constants are derived from CC BY-NC data; none are recommended here, so nothing needs to be shipped.

## Reproduce

See `scripts/bodym-eval/README.md`. Raw numbers per configuration are dumped by `run.ts --out=<file.json>` into the scratch directory (not the repo).
