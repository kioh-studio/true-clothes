# Calibration sweep — body-scan pipeline (2026-11-20)

Data: 350 synthetic bodies (a25 = 320, arms 20–30 deg; a45 = 30, arms 40–50 deg, same identities as a25_0000..0029), full-pipeline model outputs replayed offline (`scripts/offline-replay`). Split by id parity: train = even (175), held-out = odd (175). Numbers are the FUSED estimate (what the app stores), bias / MAE in cm, weighted by fixture `weight` (3 Asian / 1 other) unless marked `u` (unweighted). BodyM = testA+testB pooled (2844 fixtures, weighted, front+side, fused; mask-only, pseudo-keypoints; "om" = fixtures where the field was out of range and omitted).
Tooling added: `scripts/offline-replay/calib.ts` (evaluates a list of {S,K} configs in one process, subsets all/train/held/a25/a45 + diagnostics). Sweepable additions, all default-neutral: `S.handEraseRadius` (0.06), `S.handEraseOutsideTorso` (0), `K.useSideDepthHip` (1). tsc clean, `jest src/features/measurements` 204/204 pass. Nothing committed, no production value changed.

## Recommended constant set (apply as)

```
S.chestAt               0.25 -> 0.50
K.superellipseNChest    2.35 -> 2.25
K.useSideDepthHip       1    -> 0      (new switch: ignore measured side HIP depth, use guessed depth ratio)
```
Everything else unchanged (see Rejected / Pending).

## Headline before / after (all 350, weighted bias/MAE)

| field | default | recommended | note |
|---|---|---|---|
| bust | +15.04 / 15.21 | -0.52 / 3.82 | |
| waist | +1.26 / 3.79 | +1.26 / 3.79 | unchanged |
| hip | -9.80 / 9.87 | -7.09 / 7.14 | synth hip is biased by wide MakeHuman hips; do not read as absolute |
| inseam | -4.75 / 4.85 | unchanged | candidate 1.00 pending, see below |
| shoulder | +1.30 / 1.88 | unchanged | |
| sleeve | +1.18 / 2.28 | unchanged | |
| upper_body_length | +8.21 / 8.30 | unchanged | definition mismatch, see below |

## Per-field, default -> recommended

| field | train w | held-out w | all unweighted | a25 | a45 |
|---|---|---|---|---|---|
| bust | +15.42/15.71 -> -0.72/3.57 | +14.66/14.72 -> -0.32/4.06 | +14.84/15.02 -> -0.61/3.79 | +14.79/14.98 -> -0.45/3.87 | +17.36/17.36 -> -1.23/3.31 |
| waist | 1.21/3.60 (same) | 1.32/3.98 (same) | 1.33/3.82 (same) | same | same |
| hip | -9.69/9.83 -> -7.21/7.21 | -9.90/9.90 -> -6.98/7.08 | -9.70/9.76 -> -7.00/7.04 | -9.90/9.98 -> -7.15/7.20 | -8.69/8.69 -> -6.50/6.50 |
| shoulder | 1.30/1.88 (same) | 1.30/1.88 (same) | 1.30/1.89 (same) | +0.82/1.46 | +6.40/6.40 |

Gates (held-out gain >= 0.5 cm MAE, no other field worse by > 0.3): bust 14.72 -> 4.06 and hip 9.90 -> 7.08 pass; no other field moves.

BodyM (same recommended set, pooled testA+B, fused front+side): bust +7.7/10.2 -> +1.9/8.0 (omitted 153 -> 185 of 2844, see caveat), hip -1.6/4.6 -> -1.8/3.2; waist, shoulder, inseam unchanged. BodyM does not get worse on any field.

## 1. Bust

Root cause confirmed: the old chest row (0.25 of shoulder->hip) is at the armpit, where lats and arm roots widen the contour. Diagnostic, chest contour width divided by GROUND-TRUTH biacromial width (synth):

| | median | p10 / p90 | share > 1.0 (physically impossible) |
|---|---|---|---|
| default a25 | 0.937 | 0.85 / 1.27 | 32% |
| default a45 | 0.979 | 0.82 / 1.08 | 43% |
| chestAt 0.50 a25 | 0.764 | 0.71 / 0.85 | 1.6% |
| chestAt 0.50 a45 | 0.766 | 0.70 / 0.82 | 0% |

(Anthropometric chest/biacromial breadth is about 0.75–0.80, so the new distribution is plausible.)

`S.chestAt` alone (n = 2.35), weighted train/held MAE: 0.25 -> 15.7/14.7, 0.30 -> 12.4/12.4, 0.36 -> 9.1/9.6, 0.40 -> 6.5/7.0, 0.44 -> 4.5/5.9, 0.48 -> 3.7/4.5, 0.50 -> 3.6/4.3 (minimum), 0.52 -> 3.9/4.3, 0.56 -> 4.7/5.2.
`K.superellipseNChest` trades against the row (a lower row gives a narrower width, so a larger n compensates); BodyM wants n about 2.2 for zero bias, synth alone wants 2.4 at row 0.50 (train MAE 3.06). The recommended 2.25 is the compromise: synth held-out bias -0.3, BodyM bias +1.9, both MAE near their floor.
Joint grid (band 0.04), synth all / BodyM, for row 0.50: n 2.20 -> -1.55/4.02 / +0.6/7.9; n 2.25 -> -0.52/3.82 / +1.9/8.0; n 2.30 -> +0.67/3.72 / +3.5/8.3. Rows 0.48 and 0.52 are within 0.15 cm MAE of 0.50 on both datasets (0.48 gives -0.19/3.85 synth, +2.5/8.2 BodyM) — the optimum is a flat ridge, 0.48–0.52 are equivalent.
a45 vs a25 after the change: bust a45 -1.23/3.31 vs a25 -0.45/3.87 — arms at 45 deg are no longer harder.

Rejected for bust:
- `S.chestBand` 0.04 -> 0.02: train 3.45 -> 3.06 but held-out gain only 0.3 (< 0.5); narrower band is also noisier. Rejected by protocol.
- Tracker tolerances `S.trackTolFrac` (0.01–0.04), `S.trackTolPx` (1–4), `S.maxEdgeExtrapolation` (0.2–0.6): coordinate descent left all three at default once chestAt moved. No effect.
- n 2.4 with row 0.50 (synth-optimal): BodyM bust bias about +8, worse than default direction. Rejected.

Caveat (BodyM): omitted bust (estimate > 160 cm because the chest width failed) rises from 153 to 185 of 2844 (5.4% -> 6.5%) at row 0.50. The mean error of the remaining fixtures improves a lot, but a few percent of BodyM scans still fail the width tracking (BodyM arms are wide and the pseudo-keypoint shoulder line is not a real one). Row 0.52 has fewer omissions (163–173) at a similar MAE if this matters more than 0.1–0.3 cm of synth MAE.

## 2. Hip — the hand-erase hypothesis is NOT supported

Synth, all 350, weighted. `out` = erase only disk pixels outside the interpolated torso contour (`S.handEraseOutsideTorso`).

| option | waist bias/MAE | hip bias/MAE | side hip < waist depth (a25) | median hip/waist depth |
|---|---|---|---|---|
| radius 0.06 (current) | +1.26 / 3.79 | -9.80 / 9.87 | 82.8% | 0.885 |
| radius 0 | +1.60 / 4.07 | -9.77 / 9.87 | 84.5% | 0.872 |
| radius 0.03 | +1.58 / 4.05 | -9.79 / 9.86 | 84.5% | 0.872 |
| radius 0.09 | -1.28 / 4.06 | -9.86 / 9.86 | 57.2% | 0.964 |
| outside 0.06 | +1.57 / 4.06 | -9.79 / 9.86 | 84.5% | 0.874 |
| outside 0.09 | +1.11 / 3.84 | -9.79 / 9.86 | 84.5% | 0.891 |
| outside 0.12 | -0.30 / 3.63 | -9.86 / 9.91 | 75.8% | 0.939 |

- Hip error does not move with the radius (0 / 0.03 / 0.06 / outside), so the disk does not eat the buttock. The depth profile of the unerased side mask is flat at about 21–22 cm over rows 1.0–1.4 of the span, with no hidden maximum.
- The radius only affects WAIST depth: hands/forearms hang in front of the waist band (rows 0.6–0.9 read 30–34 cm unerased). The current 0.06 is the best of the plain disks; `outside 0.12` gets waist MAE 3.63 (gain 0.16, below the 0.5 gate) — rejected.
- The "hip depth < waist depth" pattern is a synth-mesh property: BodyM (no hands, no wrists) has median side hip/waist depth 1.125 and only 19% hip < waist, vs 0.885 / 83% on synth. ANSUR buttock depth (233 mm) vs waist depth (213 mm) also gives hip > waist for real women. MakeHuman buttocks are too flat, hips too wide laterally; synth hip bias must not be fit.
- `S.hipDownLegFraction` 0.10 / 0.25 / 0.40 -> hip bias -9.67 / -9.80 / -9.86; `S.hipUpTorsoFraction` 0 / 0.05 / 0.15 -> -9.79 / -9.80 / -9.75; `K.hipWidthCorrection` 1.0 vs 1.06 -> -9.65 vs -9.80. Diagnostic only: hip is insensitive to all of them.
- What IS consistent across both datasets: the measured side HIP depth makes hip worse than the guessed depth ratio. BodyM (no hand confound) hip MAE 3.2 without side hip depth vs 4.6 with; synth 7.1 vs 9.9. Hence the recommended switch `K.useSideDepthHip = 0` (hip only; side bust depth helps a lot on BodyM, side waist depth helps BodyM waist but hurts synth waist, so waist is left alone). BodyM hip bias is about -1.6 to -1.8 either way (no systematic bias), so no hip constant change is justified.

## 3. Inseam and upper-body length — definitions

Inseam (`K.inseamProjectionFactor`, default 0.95), synth train/held:

| factor | train | held-out |
|---|---|---|
| 0.90 | -8.9/8.9 | -8.4/8.4 |
| 0.95 | -4.97/5.06 | -4.54/4.63 |
| 1.00 | -1.35/2.45 | -1.04/2.29 |
| 1.02 | +0.12/1.89 | +0.39/2.02 |
| 1.04 | +1.58/2.16 | +1.86/2.57 |

Synth GT inseam is the standard crotch height (0.458 H, plausible for Asian proportions; ANSUR US mean 0.48 H). The app span is hip joint -> heel, so the synth data say BlazePose's hip joint sits lower (closer to the crotch) than the trochanter; 1.00–1.02 would fix it on synth. BodyM contradicts it (0.95: +0.8/2.2, 1.00: +4.8/5.3, 1.02: +6.3/6.7), but BodyM's keypoints are fabricated from the same textbook fractions (hip 0.52 H, ankle 0.039 H) so that agreement at 0.95 is circular. Not recommended without real tape fixtures; candidate = 1.00 (synth held-out inseam 4.63 -> 2.29, gate passed on synth only).

Upper-body length (`K.torsoFromShoulderHip` 0.85): this is a DEFINITION mismatch, do not tune.
- App number = 0.85 x vertical shoulder->hip-joint span; tooltip and engine fixtures define it as base of neck -> natural waist (engine tests use 41–45 cm).
- Synth GT = neck-base bone z minus waist z, mean 0.196 H (about 32 cm). ANSUR (cervicale height - waist height omphalion) is 41.6 cm female / 46.1 male = 0.255 H; ANSUR ratio to acromion->trochanter is 0.85 / 0.85, i.e. exactly the current constant. The app value (about 40 cm on these bodies) agrees with anthropometry; the synth GT is about 8–10 cm short, so its bone landmarks are not C7 / natural waist.
- Fitting the constant to synth would drive it to about 0.70 (bias +0.85 / MAE 3.4) and make real values too short. BodyM GT is "shoulder-to-crotch" (-20 cm), a third definition. Recommendation: keep 0.85; fix the synth GT definition if this field is to be benchmarked.

## 4. Shoulder (informational, no change)

a45 shoulder bias +6.4 vs a25 +0.8: with arms at 45 deg the widest row in the shoulder band includes the arms. `S.shoulderBandBelow` 0.08 -> 0.04 gives a25 -0.82/1.25 but a45 +3.55; 0.02 gives a25 -1.85/1.96, a45 +0.71/1.26. Held-out gain 1.88 -> 1.47 (0.41, below the gate) and the two arm poses want different values, so rejected. `S.shoulderBandAbove` has no effect. BodyM shoulder is +9.5 (same arm effect). A tracker-style fix (as for the chest) would be the real remedy — backlog.

## Rejected / pending summary

| candidate | result | verdict |
|---|---|---|
| chestBand 0.02 | held gain 0.3 | rejected (< 0.5) |
| trackTolFrac / trackTolPx / maxEdgeExtrapolation | no change | rejected |
| superellipseNChest 2.4 (synth-optimal) | BodyM bust bias +8 | rejected |
| handEraseRadius 0 / 0.03 / 0.09, outside-torso variants | hip unchanged, waist gain <= 0.16 | rejected |
| hipDownLeg / hipUpTorso / hipWidthCorrection | hip insensitive | rejected (diagnostic) |
| torsoFromShoulderHip 0.70 | fits a wrong-definition GT | rejected |
| shoulderBandBelow 0.04 / 0.02 | gain 0.41, a25 vs a45 conflict | rejected |
| inseamProjectionFactor 1.00 | synth 4.63 -> 2.29, BodyM (circular) 2.2 -> 5.3 | pending, needs real tape fixtures |

## Open questions

1. Which chest row do real tapes use for "bust"? The optimum (0.48–0.52 of acromion->hip joint) is lower than the anatomical nipple level (about 0.40–0.45); it is partly compensating the superellipse exponent. A real-person tape fixture would pin chestAt and n separately.
2. Synth GT `upper_body_length` and BodyM `shoulder-to-crotch` do not match the app/tooltip definition (neck base -> natural waist); neither benchmark can validate this field.
3. Inseam: where does real-photo BlazePose put the hip joint relative to the trochanter? Only real fixtures decide 0.95 vs 1.00.
4. Side WAIST depth: hurts synth (arms in front of the waist band, MAE 3.8 vs 2.5 front-only) but helps BodyM (6.2 vs 7.0). Real-photo hand/arm behaviour decides.
5. BodyM omitted-bust rate (5–7%) means about 1 in 16 scans of wide-arm A-poses fail the chest tracker; consider a fallback instead of omission.
6. u8 mask quantisation causes <= 2 cm rounding on a handful of bodies; all deltas above are far larger than that.
