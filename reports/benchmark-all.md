# MIEN body-scan benchmark — all datasets

Generated 2026-11-19 by `scripts/bench-table/build.ts` with the CURRENT tunables (nothing calibrated). Aggregates only; per-subject BodyM rows live outside the repo (BodyM is CC BY-NC, internal use).

Conventions: error = machine - real (positive = over-read), cm. **raw** = `keypointsToMeasurements`, **fused** = + `fuseWithPrior(demographicPrior)` (what the app stores). **front** = no side depth (depth guessed from priors), **side** = side-view depths used. **Weighted** (primary) uses the Asian-likeness proxy weight (BodyM: body-size density ratio, NOT ethnicity; synth: fixture weight); **unweighted** counts every subject once (BodyM photos are weighted so each subject sums to 1). P90 = 90th percentile of |err|; ±2/±4 = % of samples within that many cm.

Datasets: BodyM/train (6134 fixtures), BodyM/testA (1684 fixtures), BodyM/testB (1160 fixtures), synth-set1 (bad framing, STALE pre-tracking)/all (20 fixtures), synth-set2 (STALE pre-tracking)/all (27 fixtures).

## Rejected / omitted

A fixture is "rejected" when `keypointsToMeasurements` returns null (the app would refuse the scan). "Fields omitted" = a field with ground truth where the engine returned no value.

| dataset | split | mode | fixtures | rejected | reasons | fields omitted |
|---|---|---|---|---|---|---|
| BodyM | train | front | 6134 | 0 | - | 6834 |
| BodyM | train | side | 6134 | 0 | - | 6600 |
| BodyM | testA | front | 1684 | 0 | - | 1765 |
| BodyM | testA | side | 1684 | 0 | - | 1753 |
| BodyM | testB | front | 1160 | 0 | - | 1266 |
| BodyM | testB | side | 1160 | 0 | - | 1247 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 0 | - | 8 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 0 | - | 6 |
| synth-set2 (STALE pre-tracking) | all | front | 27 | 0 | - | 17 |
| synth-set2 (STALE pre-tracking) | all | side | 27 | 0 | - | 11 |

## Headline (fused, weighted) — bust / waist / hip / shoulder

| dataset | split | mode | field | n | real | machine | bias | MAE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | bust | 5449 | 100.9 | 115.7 | +14.8 | 16.4 | 36.1 | 12 | 24 |
| BodyM | train | front | waist | 6127 | 90.3 | 83.6 | -6.7 | 7.0 | 12.3 | 11 | 26 |
| BodyM | train | front | hip | 6127 | 101.6 | 101.0 | -0.7 | 2.6 | 5.1 | 53 | 81 |
| BodyM | train | front | shoulder_width | 6133 | 35.5 | 45.4 | +9.9 | 9.9 | 12.2 | 0 | 0 |
| BodyM | train | side | bust | 5679 | 101.3 | 109.7 | +8.5 | 10.1 | 23.6 | 17 | 34 |
| BodyM | train | side | waist | 6128 | 90.3 | 85.4 | -4.9 | 6.0 | 11.0 | 15 | 32 |
| BodyM | train | side | hip | 6130 | 101.7 | 100.9 | -0.8 | 3.5 | 6.7 | 38 | 68 |
| BodyM | train | side | shoulder_width | 6133 | 35.5 | 45.4 | +9.9 | 9.9 | 12.2 | 0 | 0 |
| BodyM | testA | front | bust | 1607 | 97.1 | 113.8 | +16.7 | 17.8 | 29.8 | 8 | 11 |
| BodyM | testA | front | waist | 1682 | 82.4 | 78.7 | -3.6 | 4.2 | 9.3 | 29 | 55 |
| BodyM | testA | front | hip | 1684 | 96.5 | 96.4 | -0.1 | 1.8 | 3.2 | 70 | 95 |
| BodyM | testA | front | shoulder_width | 1682 | 35.1 | 44.9 | +9.8 | 9.8 | 12.0 | 0 | 0 |
| BodyM | testA | side | bust | 1618 | 97.1 | 106.4 | +9.3 | 10.5 | 17.9 | 13 | 25 |
| BodyM | testA | side | waist | 1683 | 82.4 | 79.7 | -2.7 | 4.0 | 7.7 | 24 | 59 |
| BodyM | testA | side | hip | 1684 | 96.5 | 96.9 | +0.4 | 3.1 | 5.6 | 50 | 81 |
| BodyM | testA | side | shoulder_width | 1682 | 35.1 | 44.9 | +9.8 | 9.8 | 12.0 | 0 | 0 |
| BodyM | testB | front | bust | 1055 | 99.2 | 113.0 | +13.8 | 16.1 | 38.8 | 14 | 26 |
| BodyM | testB | front | waist | 1160 | 88.0 | 81.0 | -7.1 | 7.5 | 13.7 | 10 | 25 |
| BodyM | testB | front | hip | 1159 | 101.7 | 99.6 | -2.0 | 3.5 | 6.8 | 38 | 69 |
| BodyM | testB | front | shoulder_width | 1160 | 34.6 | 44.0 | +9.4 | 9.4 | 11.8 | 0 | 1 |
| BodyM | testB | side | bust | 1073 | 99.4 | 106.8 | +7.4 | 10.2 | 22.4 | 19 | 37 |
| BodyM | testB | side | waist | 1160 | 88.0 | 82.7 | -5.4 | 6.6 | 12.9 | 17 | 35 |
| BodyM | testB | side | hip | 1160 | 101.7 | 99.8 | -1.9 | 4.9 | 10.4 | 28 | 54 |
| BodyM | testB | side | shoulder_width | 1160 | 34.6 | 44.0 | +9.4 | 9.4 | 11.8 | 0 | 1 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | bust | 13 | 89.5 | 131.2 | +41.7 | 43.4 | 61.8 | 17 | 17 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | waist | 19 | 78.6 | 73.1 | -5.5 | 5.7 | 16.3 | 43 | 65 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | hip | 20 | 103.3 | 92.8 | -10.6 | 10.9 | 37.1 | 2 | 20 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | shoulder_width | 20 | 40.1 | 38.6 | -1.5 | 2.2 | 8.4 | 76 | 89 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | bust | 15 | 90.6 | 123.3 | +32.7 | 34.2 | 61.8 | 15 | 15 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | waist | 19 | 78.6 | 74.5 | -4.2 | 5.5 | 16.3 | 37 | 69 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | hip | 20 | 103.3 | 89.9 | -13.5 | 13.5 | 37.1 | 0 | 7 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | shoulder_width | 20 | 40.1 | 38.6 | -1.5 | 2.2 | 8.4 | 76 | 89 |
| synth-set2 (STALE pre-tracking) | all | front | bust | 13 | 85.2 | 131.0 | +45.8 | 45.8 | 67.7 | 9 | 17 |
| synth-set2 (STALE pre-tracking) | all | front | waist | 26 | 78.5 | 75.3 | -3.2 | 3.9 | 7.3 | 47 | 67 |
| synth-set2 (STALE pre-tracking) | all | front | hip | 26 | 102.9 | 93.5 | -9.4 | 9.4 | 9.6 | 0 | 4 |
| synth-set2 (STALE pre-tracking) | all | front | shoulder_width | 26 | 40.0 | 40.9 | +0.9 | 1.7 | 2.6 | 65 | 92 |
| synth-set2 (STALE pre-tracking) | all | side | bust | 19 | 89.3 | 129.4 | +40.1 | 40.1 | 58.7 | 6 | 11 |
| synth-set2 (STALE pre-tracking) | all | side | waist | 26 | 78.5 | 78.6 | +0.1 | 3.9 | 7.1 | 44 | 69 |
| synth-set2 (STALE pre-tracking) | all | side | hip | 26 | 102.9 | 91.1 | -11.8 | 11.8 | 13.6 | 0 | 0 |
| synth-set2 (STALE pre-tracking) | all | side | shoulder_width | 26 | 40.0 | 40.9 | +0.9 | 1.7 | 2.6 | 65 | 92 |

## Full tables per field

Columns per variant: machine mean | bias | MAE | RMSE | P90 | ±2 % | ±4 %. "real" is the mean ground truth over the same n.

### bust — weighted (primary)

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 5449 | 100.9 | 117.8 | +16.9 | 17.8 | 22.1 | 36.1 | 6 | 11 | 115.7 | +14.8 | 16.4 | 21.6 | 36.1 | 12 | 24 |
| BodyM | train | side | 5679 | 101.3 | 111.1 | +9.9 | 11.1 | 15.2 | 23.6 | 13 | 24 | 109.7 | +8.5 | 10.1 | 14.7 | 23.6 | 17 | 34 |
| BodyM | testA | front | 1607 | 97.1 | 115.1 | +18.0 | 18.3 | 21.4 | 29.8 | 6 | 10 | 113.8 | +16.7 | 17.8 | 21.2 | 29.8 | 8 | 11 |
| BodyM | testA | side | 1618 | 97.1 | 108.0 | +10.8 | 11.6 | 15.1 | 18.1 | 10 | 20 | 106.4 | +9.3 | 10.5 | 14.6 | 17.9 | 13 | 25 |
| BodyM | testB | front | 1055 | 99.2 | 114.9 | +15.8 | 17.6 | 22.3 | 38.8 | 7 | 13 | 113.0 | +13.8 | 16.1 | 21.8 | 38.8 | 14 | 26 |
| BodyM | testB | side | 1073 | 99.4 | 107.9 | +8.5 | 11.1 | 15.9 | 22.4 | 14 | 28 | 106.8 | +7.4 | 10.2 | 15.5 | 22.4 | 19 | 37 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 13 | 89.5 | 130.8 | +41.4 | 45.0 | 49.8 | 61.8 | 0 | 0 | 131.2 | +41.7 | 43.4 | 49.6 | 61.8 | 17 | 17 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 15 | 90.6 | 123.0 | +32.4 | 35.5 | 39.8 | 61.8 | 0 | 0 | 123.3 | +32.7 | 34.2 | 39.5 | 61.8 | 15 | 15 |
| synth-set2 (STALE pre-tracking) | all | front | 13 | 85.2 | 131.2 | +46.0 | 46.4 | 52.5 | 67.7 | 0 | 9 | 131.0 | +45.8 | 45.8 | 52.4 | 67.7 | 9 | 17 |
| synth-set2 (STALE pre-tracking) | all | side | 19 | 89.3 | 129.5 | +40.2 | 40.5 | 44.4 | 58.7 | 0 | 6 | 129.4 | +40.1 | 40.1 | 44.3 | 58.7 | 6 | 11 |

### bust — unweighted

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 5449 | 101.0 | 120.4 | +19.4 | 20.1 | 23.9 | 38.6 | 4 | 8 | 118.9 | +17.9 | 19.0 | 23.6 | 38.6 | 9 | 17 |
| BodyM | train | side | 5679 | 101.3 | 113.1 | +11.8 | 12.8 | 16.5 | 25.8 | 9 | 18 | 111.9 | +10.6 | 11.8 | 16.1 | 25.8 | 14 | 27 |
| BodyM | testA | front | 1607 | 99.1 | 119.0 | +20.0 | 20.4 | 23.3 | 34.4 | 3 | 6 | 118.1 | +19.0 | 19.9 | 23.1 | 34.4 | 6 | 9 |
| BodyM | testA | side | 1618 | 99.1 | 111.6 | +12.4 | 13.2 | 16.5 | 22.0 | 6 | 13 | 110.4 | +11.3 | 12.3 | 16.1 | 22.0 | 10 | 19 |
| BodyM | testB | front | 1055 | 99.1 | 116.0 | +16.9 | 18.8 | 23.0 | 38.8 | 5 | 11 | 114.5 | +15.4 | 17.4 | 22.5 | 38.8 | 12 | 21 |
| BodyM | testB | side | 1073 | 99.3 | 109.0 | +9.7 | 11.7 | 15.7 | 23.1 | 11 | 23 | 108.0 | +8.6 | 10.7 | 15.3 | 23.0 | 16 | 31 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 13 | 89.7 | 133.5 | +43.8 | 47.0 | 51.5 | 64.0 | 0 | 0 | 133.8 | +44.1 | 45.6 | 51.4 | 64.0 | 15 | 15 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 15 | 90.7 | 126.0 | +35.3 | 38.1 | 42.6 | 64.0 | 0 | 0 | 126.3 | +35.5 | 36.9 | 42.4 | 64.0 | 13 | 13 |
| synth-set2 (STALE pre-tracking) | all | front | 13 | 85.9 | 133.7 | +47.8 | 48.2 | 53.7 | 67.7 | 0 | 8 | 133.5 | +47.6 | 47.6 | 53.7 | 67.7 | 8 | 15 |
| synth-set2 (STALE pre-tracking) | all | side | 19 | 89.5 | 130.4 | +40.9 | 41.2 | 45.0 | 64.3 | 0 | 5 | 130.3 | +40.8 | 40.8 | 44.9 | 64.3 | 5 | 11 |

### waist — weighted (primary)

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6127 | 90.3 | 82.9 | -7.4 | 7.8 | 9.0 | 13.7 | 11 | 22 | 83.6 | -6.7 | 7.0 | 8.1 | 12.3 | 11 | 26 |
| BodyM | train | side | 6128 | 90.3 | 85.5 | -4.9 | 6.3 | 7.5 | 11.4 | 16 | 32 | 85.4 | -4.9 | 6.0 | 7.2 | 11.0 | 15 | 32 |
| BodyM | testA | front | 1682 | 82.4 | 78.5 | -3.8 | 4.6 | 5.9 | 9.6 | 28 | 52 | 78.7 | -3.6 | 4.2 | 5.4 | 9.3 | 29 | 55 |
| BodyM | testA | side | 1683 | 82.4 | 79.7 | -2.6 | 4.2 | 5.1 | 8.0 | 24 | 56 | 79.7 | -2.7 | 4.0 | 4.9 | 7.7 | 24 | 59 |
| BodyM | testB | front | 1160 | 88.0 | 80.2 | -7.8 | 8.5 | 10.1 | 15.7 | 9 | 22 | 81.0 | -7.1 | 7.5 | 8.9 | 13.7 | 10 | 25 |
| BodyM | testB | side | 1160 | 88.0 | 82.7 | -5.3 | 6.9 | 8.8 | 13.6 | 16 | 33 | 82.7 | -5.4 | 6.6 | 8.4 | 12.9 | 17 | 35 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 19 | 78.6 | 71.6 | -7.0 | 7.0 | 11.0 | 21.3 | 29 | 53 | 73.1 | -5.5 | 5.7 | 9.9 | 16.3 | 43 | 65 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 19 | 78.6 | 74.0 | -4.6 | 6.0 | 10.6 | 21.3 | 43 | 63 | 74.5 | -4.2 | 5.5 | 9.9 | 16.3 | 37 | 69 |
| synth-set2 (STALE pre-tracking) | all | front | 26 | 78.5 | 74.8 | -3.7 | 4.8 | 7.3 | 10.3 | 33 | 71 | 75.3 | -3.2 | 3.9 | 6.3 | 7.3 | 47 | 67 |
| synth-set2 (STALE pre-tracking) | all | side | 26 | 78.5 | 78.8 | +0.3 | 4.2 | 6.8 | 8.1 | 44 | 69 | 78.6 | +0.1 | 3.9 | 6.1 | 7.1 | 44 | 69 |

### waist — unweighted

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6127 | 89.8 | 82.3 | -7.5 | 7.9 | 9.0 | 13.6 | 9 | 20 | 83.0 | -6.8 | 7.0 | 8.0 | 12.2 | 10 | 24 |
| BodyM | train | side | 6128 | 89.8 | 84.7 | -5.1 | 6.4 | 7.4 | 11.2 | 14 | 29 | 84.8 | -5.0 | 6.1 | 7.0 | 10.7 | 14 | 30 |
| BodyM | testA | front | 1682 | 84.3 | 80.0 | -4.3 | 4.9 | 6.0 | 9.4 | 21 | 46 | 80.3 | -3.9 | 4.4 | 5.4 | 8.0 | 22 | 47 |
| BodyM | testA | side | 1683 | 84.3 | 81.8 | -2.5 | 4.3 | 5.3 | 8.1 | 25 | 52 | 81.7 | -2.6 | 4.1 | 5.0 | 7.4 | 24 | 55 |
| BodyM | testB | front | 1160 | 87.6 | 80.3 | -7.3 | 8.0 | 9.4 | 14.3 | 9 | 22 | 81.0 | -6.6 | 7.1 | 8.2 | 12.6 | 11 | 24 |
| BodyM | testB | side | 1160 | 87.6 | 82.9 | -4.7 | 6.3 | 7.9 | 11.6 | 17 | 34 | 82.8 | -4.8 | 6.0 | 7.5 | 10.9 | 17 | 36 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 19 | 78.7 | 72.1 | -6.6 | 6.6 | 10.5 | 21.3 | 26 | 58 | 73.5 | -5.3 | 5.4 | 9.5 | 16.3 | 42 | 68 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 19 | 78.7 | 74.4 | -4.4 | 5.7 | 10.1 | 21.3 | 42 | 63 | 74.8 | -3.9 | 5.3 | 9.5 | 16.3 | 37 | 68 |
| synth-set2 (STALE pre-tracking) | all | front | 26 | 78.6 | 74.9 | -3.7 | 4.7 | 7.0 | 10.3 | 31 | 73 | 75.4 | -3.2 | 3.8 | 6.1 | 7.3 | 46 | 69 |
| synth-set2 (STALE pre-tracking) | all | side | 26 | 78.6 | 79.1 | +0.5 | 4.1 | 6.6 | 8.1 | 46 | 69 | 78.8 | +0.3 | 3.7 | 6.0 | 7.1 | 46 | 69 |

### hip — weighted (primary)

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6127 | 101.6 | 102.8 | +1.2 | 3.8 | 5.1 | 7.9 | 34 | 64 | 101.0 | -0.7 | 2.6 | 3.8 | 5.1 | 53 | 81 |
| BodyM | train | side | 6130 | 101.7 | 101.3 | -0.4 | 4.3 | 5.6 | 8.7 | 29 | 55 | 100.9 | -0.8 | 3.5 | 4.8 | 6.7 | 38 | 68 |
| BodyM | testA | front | 1684 | 96.5 | 98.0 | +1.5 | 3.4 | 4.6 | 6.9 | 37 | 69 | 96.4 | -0.1 | 1.8 | 3.2 | 3.2 | 70 | 95 |
| BodyM | testA | side | 1684 | 96.5 | 97.6 | +1.1 | 4.1 | 5.8 | 8.4 | 34 | 63 | 96.9 | +0.4 | 3.1 | 5.1 | 5.6 | 50 | 81 |
| BodyM | testB | front | 1159 | 101.7 | 100.9 | -0.8 | 4.3 | 5.7 | 8.8 | 31 | 55 | 99.6 | -2.0 | 3.5 | 4.6 | 6.8 | 38 | 69 |
| BodyM | testB | side | 1160 | 101.7 | 100.3 | -1.4 | 5.6 | 7.5 | 12.3 | 24 | 44 | 99.8 | -1.9 | 4.9 | 6.9 | 10.4 | 28 | 54 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 103.3 | 96.9 | -6.5 | 8.6 | 16.4 | 37.1 | 33 | 72 | 92.8 | -10.6 | 10.9 | 17.0 | 37.1 | 2 | 20 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 103.3 | 90.3 | -13.0 | 13.0 | 18.1 | 37.1 | 11 | 19 | 89.9 | -13.5 | 13.5 | 18.1 | 37.1 | 0 | 7 |
| synth-set2 (STALE pre-tracking) | all | front | 26 | 102.9 | 96.7 | -6.1 | 6.4 | 12.7 | 6.1 | 29 | 56 | 93.5 | -9.4 | 9.4 | 13.7 | 9.6 | 0 | 4 |
| synth-set2 (STALE pre-tracking) | all | side | 26 | 102.9 | 91.0 | -11.9 | 11.9 | 15.2 | 14.4 | 0 | 4 | 91.1 | -11.8 | 11.8 | 15.1 | 13.6 | 0 | 0 |

### hip — unweighted

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6127 | 102.3 | 103.6 | +1.3 | 3.8 | 5.1 | 8.0 | 34 | 63 | 101.7 | -0.6 | 2.5 | 3.7 | 4.8 | 54 | 84 |
| BodyM | train | side | 6130 | 102.3 | 102.0 | -0.3 | 4.3 | 5.6 | 8.8 | 29 | 56 | 101.6 | -0.7 | 3.4 | 4.7 | 6.7 | 38 | 69 |
| BodyM | testA | front | 1684 | 99.3 | 101.0 | +1.7 | 3.5 | 5.0 | 7.0 | 38 | 69 | 99.3 | +0.0 | 2.1 | 3.7 | 3.8 | 63 | 91 |
| BodyM | testA | side | 1684 | 99.3 | 100.4 | +1.1 | 4.1 | 5.8 | 8.4 | 34 | 64 | 99.8 | +0.5 | 3.1 | 5.0 | 5.7 | 47 | 79 |
| BodyM | testB | front | 1159 | 102.3 | 102.2 | -0.1 | 4.3 | 5.6 | 8.9 | 29 | 56 | 100.9 | -1.4 | 3.2 | 4.4 | 6.3 | 41 | 74 |
| BodyM | testB | side | 1160 | 102.3 | 101.9 | -0.4 | 5.1 | 6.7 | 10.7 | 26 | 48 | 101.3 | -1.0 | 4.2 | 5.9 | 8.7 | 33 | 60 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 103.1 | 97.3 | -5.7 | 8.0 | 15.6 | 31.4 | 30 | 75 | 93.2 | -9.9 | 10.2 | 16.2 | 31.4 | 5 | 25 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 103.1 | 90.7 | -12.4 | 12.4 | 17.3 | 31.4 | 10 | 20 | 90.2 | -12.9 | 12.9 | 17.4 | 31.4 | 0 | 10 |
| synth-set2 (STALE pre-tracking) | all | front | 26 | 102.7 | 96.7 | -6.0 | 6.2 | 12.2 | 6.1 | 27 | 54 | 93.5 | -9.1 | 9.1 | 13.3 | 9.6 | 0 | 4 |
| synth-set2 (STALE pre-tracking) | all | side | 26 | 102.7 | 90.9 | -11.8 | 11.8 | 14.9 | 14.4 | 0 | 4 | 91.1 | -11.6 | 11.6 | 14.7 | 13.6 | 0 | 0 |

### inseam — weighted (primary)

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6134 | 75.5 | 77.0 | +1.5 | 2.2 | 2.7 | 4.3 | 53 | 87 | 77.0 | +1.5 | 2.2 | 2.7 | 4.3 | 53 | 87 |
| BodyM | train | side | 6134 | 75.5 | 77.0 | +1.5 | 2.2 | 2.7 | 4.3 | 53 | 87 | 77.0 | +1.5 | 2.2 | 2.7 | 4.3 | 53 | 87 |
| BodyM | testA | front | 1684 | 75.5 | 76.6 | +1.1 | 2.0 | 2.4 | 4.3 | 64 | 90 | 76.6 | +1.1 | 2.0 | 2.4 | 4.3 | 64 | 90 |
| BodyM | testA | side | 1684 | 75.5 | 76.6 | +1.1 | 2.0 | 2.4 | 4.3 | 64 | 90 | 76.6 | +1.1 | 2.0 | 2.4 | 4.3 | 64 | 90 |
| BodyM | testB | front | 1160 | 74.6 | 75.3 | +0.7 | 2.3 | 3.2 | 4.8 | 56 | 87 | 75.3 | +0.7 | 2.3 | 3.2 | 4.8 | 56 | 87 |
| BodyM | testB | side | 1160 | 74.6 | 75.3 | +0.7 | 2.3 | 3.2 | 4.8 | 56 | 87 | 75.3 | +0.7 | 2.3 | 3.2 | 4.8 | 56 | 87 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 73.4 | 74.6 | +1.2 | 2.8 | 3.9 | 7.5 | 63 | 70 | 74.6 | +1.2 | 2.8 | 3.9 | 7.5 | 63 | 70 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 73.4 | 74.6 | +1.2 | 2.8 | 3.9 | 7.5 | 63 | 70 | 74.6 | +1.2 | 2.8 | 3.9 | 7.5 | 63 | 70 |
| synth-set2 (STALE pre-tracking) | all | front | 27 | 73.2 | 68.5 | -4.8 | 4.9 | 5.4 | 7.7 | 21 | 33 | 68.5 | -4.8 | 4.9 | 5.4 | 7.7 | 21 | 33 |
| synth-set2 (STALE pre-tracking) | all | side | 27 | 73.2 | 68.5 | -4.8 | 4.9 | 5.4 | 7.7 | 21 | 33 | 68.5 | -4.8 | 4.9 | 5.4 | 7.7 | 21 | 33 |

### inseam — unweighted

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6134 | 78.3 | 79.4 | +1.0 | 2.0 | 2.5 | 4.0 | 58 | 90 | 79.4 | +1.0 | 2.0 | 2.5 | 4.0 | 58 | 90 |
| BodyM | train | side | 6134 | 78.3 | 79.4 | +1.0 | 2.0 | 2.5 | 4.0 | 58 | 90 | 79.4 | +1.0 | 2.0 | 2.5 | 4.0 | 58 | 90 |
| BodyM | testA | front | 1684 | 78.4 | 79.0 | +0.6 | 2.1 | 2.6 | 4.7 | 57 | 86 | 79.0 | +0.6 | 2.1 | 2.6 | 4.7 | 57 | 86 |
| BodyM | testA | side | 1684 | 78.4 | 79.0 | +0.6 | 2.1 | 2.6 | 4.7 | 57 | 86 | 79.0 | +0.6 | 2.1 | 2.6 | 4.7 | 57 | 86 |
| BodyM | testB | front | 1160 | 76.9 | 77.6 | +0.7 | 2.0 | 2.8 | 4.1 | 61 | 90 | 77.6 | +0.7 | 2.0 | 2.8 | 4.1 | 61 | 90 |
| BodyM | testB | side | 1160 | 76.9 | 77.6 | +0.7 | 2.0 | 2.8 | 4.1 | 61 | 90 | 77.6 | +0.7 | 2.0 | 2.8 | 4.1 | 61 | 90 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 73.6 | 74.4 | +0.8 | 2.9 | 3.8 | 6.7 | 60 | 70 | 74.4 | +0.8 | 2.9 | 3.8 | 6.7 | 60 | 70 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 73.6 | 74.4 | +0.8 | 2.9 | 3.8 | 6.7 | 60 | 70 | 74.4 | +0.8 | 2.9 | 3.8 | 6.7 | 60 | 70 |
| synth-set2 (STALE pre-tracking) | all | front | 27 | 73.5 | 68.7 | -4.8 | 4.9 | 5.4 | 7.7 | 22 | 33 | 68.7 | -4.8 | 4.9 | 5.4 | 7.7 | 22 | 33 |
| synth-set2 (STALE pre-tracking) | all | side | 27 | 73.5 | 68.7 | -4.8 | 4.9 | 5.4 | 7.7 | 22 | 33 | 68.7 | -4.8 | 4.9 | 5.4 | 7.7 | 22 | 33 |

### shoulder_width — weighted (primary)

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6133 | 35.5 | 45.4 | +9.9 | 9.9 | 10.1 | 12.2 | 0 | 0 | 45.4 | +9.9 | 9.9 | 10.1 | 12.2 | 0 | 0 |
| BodyM | train | side | 6133 | 35.5 | 45.4 | +9.9 | 9.9 | 10.1 | 12.2 | 0 | 0 | 45.4 | +9.9 | 9.9 | 10.1 | 12.2 | 0 | 0 |
| BodyM | testA | front | 1682 | 35.1 | 44.9 | +9.8 | 9.8 | 10.0 | 12.0 | 0 | 0 | 44.9 | +9.8 | 9.8 | 10.0 | 12.0 | 0 | 0 |
| BodyM | testA | side | 1682 | 35.1 | 44.9 | +9.8 | 9.8 | 10.0 | 12.0 | 0 | 0 | 44.9 | +9.8 | 9.8 | 10.0 | 12.0 | 0 | 0 |
| BodyM | testB | front | 1160 | 34.6 | 44.0 | +9.4 | 9.4 | 9.6 | 11.8 | 0 | 1 | 44.0 | +9.4 | 9.4 | 9.6 | 11.8 | 0 | 1 |
| BodyM | testB | side | 1160 | 34.6 | 44.0 | +9.4 | 9.4 | 9.6 | 11.8 | 0 | 1 | 44.0 | +9.4 | 9.4 | 9.6 | 11.8 | 0 | 1 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 40.1 | 38.6 | -1.5 | 2.2 | 3.3 | 8.4 | 76 | 89 | 38.6 | -1.5 | 2.2 | 3.3 | 8.4 | 76 | 89 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 40.1 | 38.6 | -1.5 | 2.2 | 3.3 | 8.4 | 76 | 89 | 38.6 | -1.5 | 2.2 | 3.3 | 8.4 | 76 | 89 |
| synth-set2 (STALE pre-tracking) | all | front | 26 | 40.0 | 40.9 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 | 40.9 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 |
| synth-set2 (STALE pre-tracking) | all | side | 26 | 40.0 | 40.9 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 | 40.9 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 |

### shoulder_width — unweighted

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6133 | 35.8 | 46.3 | +10.5 | 10.5 | 10.7 | 12.8 | 0 | 0 | 46.3 | +10.5 | 10.5 | 10.7 | 12.8 | 0 | 0 |
| BodyM | train | side | 6133 | 35.8 | 46.3 | +10.5 | 10.5 | 10.7 | 12.8 | 0 | 0 | 46.3 | +10.5 | 10.5 | 10.7 | 12.8 | 0 | 0 |
| BodyM | testA | front | 1682 | 35.5 | 46.0 | +10.4 | 10.4 | 10.6 | 13.0 | 0 | 0 | 46.0 | +10.4 | 10.4 | 10.6 | 13.0 | 0 | 0 |
| BodyM | testA | side | 1682 | 35.5 | 46.0 | +10.4 | 10.4 | 10.6 | 13.0 | 0 | 0 | 46.0 | +10.4 | 10.4 | 10.6 | 13.0 | 0 | 0 |
| BodyM | testB | front | 1160 | 34.8 | 45.0 | +10.2 | 10.2 | 10.4 | 12.5 | 0 | 0 | 45.0 | +10.2 | 10.2 | 10.4 | 12.5 | 0 | 0 |
| BodyM | testB | side | 1160 | 34.8 | 45.0 | +10.2 | 10.2 | 10.4 | 12.5 | 0 | 0 | 45.0 | +10.2 | 10.2 | 10.4 | 12.5 | 0 | 0 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 40.1 | 38.9 | -1.2 | 2.1 | 3.1 | 3.5 | 75 | 90 | 38.9 | -1.2 | 2.1 | 3.1 | 3.5 | 75 | 90 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 40.1 | 38.9 | -1.2 | 2.1 | 3.1 | 3.5 | 75 | 90 | 38.9 | -1.2 | 2.1 | 3.1 | 3.5 | 75 | 90 |
| synth-set2 (STALE pre-tracking) | all | front | 26 | 39.9 | 40.8 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 | 40.8 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 |
| synth-set2 (STALE pre-tracking) | all | side | 26 | 39.9 | 40.8 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 | 40.8 | +0.9 | 1.7 | 2.0 | 2.6 | 65 | 92 |

### sleeve_length — weighted (primary)

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 46.8 | 45.0 | -1.8 | 2.0 | 2.6 | 4.5 | 57 | 85 | 45.0 | -1.8 | 2.0 | 2.6 | 4.5 | 57 | 85 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 46.8 | 45.0 | -1.8 | 2.0 | 2.6 | 4.5 | 57 | 85 | 45.0 | -1.8 | 2.0 | 2.6 | 4.5 | 57 | 85 |
| synth-set2 (STALE pre-tracking) | all | front | 27 | 46.6 | 48.4 | +1.8 | 2.9 | 3.5 | 5.2 | 23 | 80 | 48.4 | +1.8 | 2.9 | 3.5 | 5.2 | 23 | 80 |
| synth-set2 (STALE pre-tracking) | all | side | 27 | 46.6 | 48.4 | +1.8 | 2.9 | 3.5 | 5.2 | 23 | 80 | 48.4 | +1.8 | 2.9 | 3.5 | 5.2 | 23 | 80 |

### sleeve_length — unweighted

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 47.0 | 45.0 | -1.9 | 2.2 | 2.8 | 4.9 | 55 | 80 | 45.0 | -1.9 | 2.2 | 2.8 | 4.9 | 55 | 80 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 47.0 | 45.0 | -1.9 | 2.2 | 2.8 | 4.9 | 55 | 80 | 45.0 | -1.9 | 2.2 | 2.8 | 4.9 | 55 | 80 |
| synth-set2 (STALE pre-tracking) | all | front | 27 | 46.8 | 48.4 | +1.6 | 2.8 | 3.4 | 5.2 | 26 | 81 | 48.4 | +1.6 | 2.8 | 3.4 | 5.2 | 26 | 81 |
| synth-set2 (STALE pre-tracking) | all | side | 27 | 46.8 | 48.4 | +1.6 | 2.8 | 3.4 | 5.2 | 26 | 81 | 48.4 | +1.6 | 2.8 | 3.4 | 5.2 | 26 | 81 |

### upper_body_length — weighted (primary)

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6134 | 63.5 | 42.7 | -20.9 | 20.9 | 21.1 | 25.2 | 0 | 0 | 42.7 | -20.9 | 20.9 | 21.1 | 25.2 | 0 | 0 |
| BodyM | train | side | 6134 | 63.5 | 42.7 | -20.9 | 20.9 | 21.1 | 25.2 | 0 | 0 | 42.7 | -20.9 | 20.9 | 21.1 | 25.2 | 0 | 0 |
| BodyM | testA | front | 1684 | 62.5 | 42.6 | -20.0 | 20.0 | 20.2 | 24.4 | 0 | 0 | 42.6 | -20.0 | 20.0 | 20.2 | 24.4 | 0 | 0 |
| BodyM | testA | side | 1684 | 62.5 | 42.6 | -20.0 | 20.0 | 20.2 | 24.4 | 0 | 0 | 42.6 | -20.0 | 20.0 | 20.2 | 24.4 | 0 | 0 |
| BodyM | testB | front | 1160 | 62.0 | 41.8 | -20.3 | 20.3 | 20.6 | 25.6 | 0 | 0 | 41.8 | -20.3 | 20.3 | 20.6 | 25.6 | 0 | 0 |
| BodyM | testB | side | 1160 | 62.0 | 41.8 | -20.3 | 20.3 | 20.6 | 25.6 | 0 | 0 | 41.8 | -20.3 | 20.3 | 20.6 | 25.6 | 0 | 0 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 30.7 | 37.6 | +7.0 | 7.4 | 8.1 | 11.7 | 6 | 20 | 37.6 | +7.0 | 7.4 | 8.1 | 11.7 | 6 | 20 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 30.7 | 37.6 | +7.0 | 7.4 | 8.1 | 11.7 | 6 | 20 | 37.6 | +7.0 | 7.4 | 8.1 | 11.7 | 6 | 20 |
| synth-set2 (STALE pre-tracking) | all | front | 27 | 30.5 | 39.7 | +9.2 | 9.2 | 9.8 | 13.1 | 0 | 7 | 39.7 | +9.2 | 9.2 | 9.8 | 13.1 | 0 | 7 |
| synth-set2 (STALE pre-tracking) | all | side | 27 | 30.5 | 39.7 | +9.2 | 9.2 | 9.8 | 13.1 | 0 | 7 | 39.7 | +9.2 | 9.2 | 9.8 | 13.1 | 0 | 7 |

### upper_body_length — unweighted

| dataset | split | mode | n | real | raw: machine | bias | MAE | RMSE | P90 | ±2 | ±4 | fused: machine | bias | MAE | RMSE | P90 | ±2 | ±4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BodyM | train | front | 6134 | 65.0 | 44.0 | -21.0 | 21.0 | 21.2 | 24.7 | 0 | 0 | 44.0 | -21.0 | 21.0 | 21.2 | 24.7 | 0 | 0 |
| BodyM | train | side | 6134 | 65.0 | 44.0 | -21.0 | 21.0 | 21.2 | 24.7 | 0 | 0 | 44.0 | -21.0 | 21.0 | 21.2 | 24.7 | 0 | 0 |
| BodyM | testA | front | 1684 | 64.2 | 43.9 | -20.3 | 20.3 | 20.5 | 24.5 | 0 | 0 | 43.9 | -20.3 | 20.3 | 20.5 | 24.5 | 0 | 0 |
| BodyM | testA | side | 1684 | 64.2 | 43.9 | -20.3 | 20.3 | 20.5 | 24.5 | 0 | 0 | 43.9 | -20.3 | 20.3 | 20.5 | 24.5 | 0 | 0 |
| BodyM | testB | front | 1160 | 63.1 | 43.0 | -20.1 | 20.1 | 20.4 | 24.4 | 0 | 0 | 43.0 | -20.1 | 20.1 | 20.4 | 24.4 | 0 | 0 |
| BodyM | testB | side | 1160 | 63.1 | 43.0 | -20.1 | 20.1 | 20.4 | 24.4 | 0 | 0 | 43.0 | -20.1 | 20.1 | 20.4 | 24.4 | 0 | 0 |
| synth-set1 (bad framing, STALE pre-tracking) | all | front | 20 | 31.0 | 37.9 | +6.9 | 7.3 | 8.0 | 11.7 | 5 | 25 | 37.9 | +6.9 | 7.3 | 8.0 | 11.7 | 5 | 25 |
| synth-set1 (bad framing, STALE pre-tracking) | all | side | 20 | 31.0 | 37.9 | +6.9 | 7.3 | 8.0 | 11.7 | 5 | 25 | 37.9 | +6.9 | 7.3 | 8.0 | 11.7 | 5 | 25 |
| synth-set2 (STALE pre-tracking) | all | front | 27 | 30.8 | 39.7 | +9.0 | 9.0 | 9.6 | 13.1 | 0 | 11 | 39.7 | +9.0 | 9.0 | 9.6 | 13.1 | 0 | 11 |
| synth-set2 (STALE pre-tracking) | all | side | 27 | 30.8 | 39.7 | +9.0 | 9.0 | 9.6 | 13.1 | 0 | 11 | 39.7 | +9.0 | 9.0 | 9.6 | 13.1 | 0 | 11 |

## Systematic patterns (auto-detected, fused, weighted: |bias| >= 3 cm and >= 60% of MAE)

Numbers only; no calibration is proposed here.

- BodyM / train / front / bust (fused): over-read, bias +14.8 cm vs MAE 16.4 (n=5449, real 100.9 -> machine 115.7)
- BodyM / train / front / waist (fused): under-read, bias -6.7 cm vs MAE 7.0 (n=6127, real 90.3 -> machine 83.6)
- BodyM / train / front / shoulder_width (fused): over-read, bias +9.9 cm vs MAE 9.9 (n=6133, real 35.5 -> machine 45.4)
- BodyM / train / front / upper_body_length (fused): under-read, bias -20.9 cm vs MAE 20.9 (n=6134, real 63.5 -> machine 42.7)
- BodyM / train / side / bust (fused): over-read, bias +8.5 cm vs MAE 10.1 (n=5679, real 101.3 -> machine 109.7)
- BodyM / train / side / waist (fused): under-read, bias -4.9 cm vs MAE 6.0 (n=6128, real 90.3 -> machine 85.4)
- BodyM / train / side / shoulder_width (fused): over-read, bias +9.9 cm vs MAE 9.9 (n=6133, real 35.5 -> machine 45.4)
- BodyM / train / side / upper_body_length (fused): under-read, bias -20.9 cm vs MAE 20.9 (n=6134, real 63.5 -> machine 42.7)
- BodyM / testA / front / bust (fused): over-read, bias +16.7 cm vs MAE 17.8 (n=1607, real 97.1 -> machine 113.8)
- BodyM / testA / front / waist (fused): under-read, bias -3.6 cm vs MAE 4.2 (n=1682, real 82.4 -> machine 78.7)
- BodyM / testA / front / shoulder_width (fused): over-read, bias +9.8 cm vs MAE 9.8 (n=1682, real 35.1 -> machine 44.9)
- BodyM / testA / front / upper_body_length (fused): under-read, bias -20.0 cm vs MAE 20.0 (n=1684, real 62.5 -> machine 42.6)
- BodyM / testA / side / bust (fused): over-read, bias +9.3 cm vs MAE 10.5 (n=1618, real 97.1 -> machine 106.4)
- BodyM / testA / side / shoulder_width (fused): over-read, bias +9.8 cm vs MAE 9.8 (n=1682, real 35.1 -> machine 44.9)
- BodyM / testA / side / upper_body_length (fused): under-read, bias -20.0 cm vs MAE 20.0 (n=1684, real 62.5 -> machine 42.6)
- BodyM / testB / front / bust (fused): over-read, bias +13.8 cm vs MAE 16.1 (n=1055, real 99.2 -> machine 113.0)
- BodyM / testB / front / waist (fused): under-read, bias -7.1 cm vs MAE 7.5 (n=1160, real 88.0 -> machine 81.0)
- BodyM / testB / front / shoulder_width (fused): over-read, bias +9.4 cm vs MAE 9.4 (n=1160, real 34.6 -> machine 44.0)
- BodyM / testB / front / upper_body_length (fused): under-read, bias -20.3 cm vs MAE 20.3 (n=1160, real 62.0 -> machine 41.8)
- BodyM / testB / side / bust (fused): over-read, bias +7.4 cm vs MAE 10.2 (n=1073, real 99.4 -> machine 106.8)
- BodyM / testB / side / waist (fused): under-read, bias -5.4 cm vs MAE 6.6 (n=1160, real 88.0 -> machine 82.7)
- BodyM / testB / side / shoulder_width (fused): over-read, bias +9.4 cm vs MAE 9.4 (n=1160, real 34.6 -> machine 44.0)
- BodyM / testB / side / upper_body_length (fused): under-read, bias -20.3 cm vs MAE 20.3 (n=1160, real 62.0 -> machine 41.8)
- synth-set1 (bad framing, STALE pre-tracking) / all / front / bust (fused): over-read, bias +41.7 cm vs MAE 43.4 (n=13, real 89.5 -> machine 131.2)
- synth-set1 (bad framing, STALE pre-tracking) / all / front / waist (fused): under-read, bias -5.5 cm vs MAE 5.7 (n=19, real 78.6 -> machine 73.1)
- synth-set1 (bad framing, STALE pre-tracking) / all / front / hip (fused): under-read, bias -10.6 cm vs MAE 10.9 (n=20, real 103.3 -> machine 92.8)
- synth-set1 (bad framing, STALE pre-tracking) / all / front / upper_body_length (fused): over-read, bias +7.0 cm vs MAE 7.4 (n=20, real 30.7 -> machine 37.6)
- synth-set1 (bad framing, STALE pre-tracking) / all / side / bust (fused): over-read, bias +32.7 cm vs MAE 34.2 (n=15, real 90.6 -> machine 123.3)
- synth-set1 (bad framing, STALE pre-tracking) / all / side / waist (fused): under-read, bias -4.2 cm vs MAE 5.5 (n=19, real 78.6 -> machine 74.5)
- synth-set1 (bad framing, STALE pre-tracking) / all / side / hip (fused): under-read, bias -13.5 cm vs MAE 13.5 (n=20, real 103.3 -> machine 89.9)
- synth-set1 (bad framing, STALE pre-tracking) / all / side / upper_body_length (fused): over-read, bias +7.0 cm vs MAE 7.4 (n=20, real 30.7 -> machine 37.6)
- synth-set2 (STALE pre-tracking) / all / front / bust (fused): over-read, bias +45.8 cm vs MAE 45.8 (n=13, real 85.2 -> machine 131.0)
- synth-set2 (STALE pre-tracking) / all / front / waist (fused): under-read, bias -3.2 cm vs MAE 3.9 (n=26, real 78.5 -> machine 75.3)
- synth-set2 (STALE pre-tracking) / all / front / hip (fused): under-read, bias -9.4 cm vs MAE 9.4 (n=26, real 102.9 -> machine 93.5)
- synth-set2 (STALE pre-tracking) / all / front / inseam (fused): under-read, bias -4.8 cm vs MAE 4.9 (n=27, real 73.2 -> machine 68.5)
- synth-set2 (STALE pre-tracking) / all / front / upper_body_length (fused): over-read, bias +9.2 cm vs MAE 9.2 (n=27, real 30.5 -> machine 39.7)
- synth-set2 (STALE pre-tracking) / all / side / bust (fused): over-read, bias +40.1 cm vs MAE 40.1 (n=19, real 89.3 -> machine 129.4)
- synth-set2 (STALE pre-tracking) / all / side / hip (fused): under-read, bias -11.8 cm vs MAE 11.8 (n=26, real 102.9 -> machine 91.1)
- synth-set2 (STALE pre-tracking) / all / side / inseam (fused): under-read, bias -4.8 cm vs MAE 4.9 (n=27, real 73.2 -> machine 68.5)
- synth-set2 (STALE pre-tracking) / all / side / upper_body_length (fused): over-read, bias +9.2 cm vs MAE 9.2 (n=27, real 30.5 -> machine 39.7)

## Example: synth-set1 (bad framing, STALE pre-tracking) — 10 subjects, side mode, real vs machine (fused; raw in brackets)

Cell = real -> machine (err) [raw machine]. Synthetic bodies are ours, so per-subject rows are shown.

| subject | sex | H cm | kg | bust | waist | hip | shoulder |
|---|---|---|---|---|---|---|---|
| body_0000 | male | 178 | 78 | 104.2 -> 96.0 (-8.2) [89.0] | 90.6 -> 56.0 (-34.6) [56.0] * | 102.1 -> 65.0 (-37.1) [65.0] * | 41.4 -> 33.0 (-8.4) [33.0] |
| body_0001 | female | 159 | 71 | n/a | 81.7 -> 82.0 (+0.3) [81.0] | 115.4 -> 103.0 (-12.4) [103.0] | 40.7 -> 39.0 (-1.7) [39.0] |
| body_0002 | female | 155 | 62 | 90.0 -> 154.0 (+64.0) [154.0] * | 76.9 -> 75.0 (-1.9) [75.0] | 110.1 -> 98.0 (-12.1) [98.0] | 37.7 -> 38.0 (+0.3) [38.0] |
| body_0003 | female | 151 | 64 | 96.7 -> 124.0 (+27.3) [124.0] * | 78.9 -> 69.0 (-9.9) [67.0] | 113.1 -> 99.0 (-14.1) [98.0] | 39.6 -> 38.0 (-1.6) [38.0] |
| body_0004 | male | 163 | 68 | 97.8 -> 138.0 (+40.2) [138.0] * | 86.4 -> 85.0 (-1.4) [86.0] | 103.3 -> 95.0 (-8.3) [95.0] | 40.4 -> 42.0 (+1.6) [42.0] |
| body_0005 | female | 153 | 47 | 82.8 -> 131.0 (+48.2) [131.0] * | 66.9 -> 62.0 (-4.9) [61.0] | 96.3 -> 87.0 (-9.3) [87.0] | 36.9 -> 34.0 (-2.9) [34.0] |
| body_0006 | female | 153 | 44 | 79.5 -> 118.0 (+38.5) [118.0] * | 62.3 -> 67.0 (+4.7) [67.0] | 95.4 -> 91.0 (-4.4) [94.0] | 36.9 -> 36.0 (-0.9) [36.0] |
| body_0007 | female | 144 | 41 | 80.1 -> 113.0 (+32.9) [113.0] * | 63.7 -> 63.0 (-0.7) [63.0] | 92.7 -> 88.0 (-4.7) [90.0] | 35.6 -> 35.0 (-0.6) [35.0] |
| body_0008 | male | 165 | 67 | n/a | 87.8 -> 85.0 (-2.8) [86.0] | 99.4 -> 94.0 (-5.4) [94.0] | 40.8 -> 42.0 (+1.2) [42.0] |
| body_0009 | female | 162 | 66 | 91.8 -> 90.0 (-1.8) [86.0] | n/a | 112.6 -> 64.0 (-48.6) [64.0] * | 40.8 -> 32.0 (-8.8) [32.0] |

`*` = flagged outlier by `fuseWithPrior` (raw scan kept). "n/a" = scan rejected or field omitted.

## Example: synth-set2 (STALE pre-tracking) — 10 subjects, side mode, real vs machine (fused; raw in brackets)

Cell = real -> machine (err) [raw machine]. Synthetic bodies are ours, so per-subject rows are shown.

| subject | sex | H cm | kg | bust | waist | hip | shoulder |
|---|---|---|---|---|---|---|---|
| body_0000 | male | 178 | 78 | n/a | 90.6 -> 87.0 (-3.6) [88.0] | 102.1 -> 93.0 (-9.1) [89.0] | 41.4 -> 43.0 (+1.6) [43.0] |
| body_0001 | female | 159 | 71 | n/a | 81.7 -> 83.0 (+1.3) [82.0] | 115.4 -> 102.0 (-13.4) [101.0] | 40.7 -> 39.0 (-1.7) [39.0] |
| body_0002 | female | 155 | 62 | 90.0 -> 126.0 (+36.0) [126.0] * | 76.9 -> 78.0 (+1.1) [78.0] | 110.1 -> 98.0 (-12.1) [98.0] | 37.7 -> 37.0 (-0.7) [37.0] |
| body_0003 | female | 151 | 64 | 96.7 -> 138.0 (+41.3) [138.0] * | 78.9 -> 83.0 (+4.1) [83.0] | 113.1 -> 102.0 (-11.1) [103.0] | 39.6 -> 41.0 (+1.4) [41.0] |
| body_0004 | male | 163 | 68 | 97.8 -> 147.0 (+49.2) [147.0] * | 86.4 -> 86.0 (-0.4) [87.0] | 103.3 -> 95.0 (-8.3) [95.0] | 40.4 -> 43.0 (+2.6) [43.0] |
| body_0005 | female | 153 | 47 | 82.8 -> 124.0 (+41.2) [124.0] * | 66.9 -> 74.0 (+7.1) [75.0] | 96.3 -> 89.0 (-7.3) [90.0] | 36.9 -> 38.0 (+1.1) [38.0] |
| body_0006 | female | 153 | 44 | 79.5 -> 81.0 (+1.5) [77.0] | n/a | n/a | n/a |
| body_0007 | female | 144 | 41 | 80.1 -> 113.0 (+32.9) [113.0] * | 63.7 -> 64.0 (+0.3) [64.0] | 92.7 -> 83.0 (-9.7) [83.0] | 35.6 -> 35.0 (-0.6) [35.0] |
| body_0008 | male | 165 | 67 | n/a | 87.8 -> 86.0 (-1.8) [87.0] | 99.4 -> 92.0 (-7.4) [90.0] | 40.8 -> 43.0 (+2.2) [43.0] |
| body_0009 | female | 162 | 66 | 91.8 -> 136.0 (+44.2) [136.0] * | 76.9 -> 79.0 (+2.1) [79.0] | 112.6 -> 99.0 (-13.6) [99.0] | 40.8 -> 42.0 (+1.2) [42.0] |

`*` = flagged outlier by `fuseWithPrior` (raw scan kept). "n/a" = scan rejected or field omitted.

## What each dataset can and cannot validate

**BodyM** (Amazon, 8,978 photo pairs, CC BY-NC, internal only)
- Masks only, no RGB: the pose model never runs. Keypoints are PSEUDO-keypoints placed from the mask with textbook stature fractions, so the keypoint terms of shoulder, inseam and upper_body_length are functions of height alone. Those three are low validity, not a test of the pose model.
- Subjects stand in an A-pose; arms merge with the torso in the chest and shoulder mask rows, so **bust and shoulder are invalid** (arm artefact) and not usable for calibration. Waist and hip are the only girths it can judge, and only as contour/side-depth math (segmentation band, superellipse depth model), not as end-to-end performance.
- Definition mismatches: BodyM shoulder-to-crotch (~60 cm) vs our `upper_body_length` (neck base to natural waist, ~0.85 x shoulder-to-hip) is a constant offset, not an error. BodyM waist is mesh-defined (probably navel/natural waist), larger than our narrowest-row waist. Sleeve has no arm keypoints, so it is not meaningfully scored. SMPL-mesh ground truth, not tape.
- Weights are a body-size proxy for "Asian-like", not ethnicity; they cannot represent Asian-specific proportions.
- Rows from the same subject are correlated (testA has ~19 photos per subject); effective n is the subject count.

**Synthetic renders through the REAL app pipeline** (emulator replay, fixture v2)
- Exercises the real pose model + segmentation + side-view on rendered bodies with exact mesh ground truth, so all seven fields are scored end-to-end.
- Sim-to-real gap: rendered skin/clothing/lighting, mesh-defined landmarks, and generator body-shape priors can differ from real people; a bias here is a hint, not proof, on real users.
- **synth-set1 has bad framing**: the person fills only about 0.5 of the frame and fails the app's live gate (`minPersonFrameFraction`), so numbers are pessimistic on resolution and are NOT representative of an accepted real scan. Re-run with set2 when available.
- Small n (about 20 bodies): means are noisy and P90 is nearly the max.
