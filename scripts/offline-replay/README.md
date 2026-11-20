# offline-replay — iterate on post-model geometry constants without the emulator

Models (MoveNet / BlazePose / MODNet) must run on device. Everything AFTER them is pure TS
(`src/features/measurements/processPure.ts::processFromModelOutputs`, called by BOTH
`processScan` on device and these tools). Dump the model outputs once, then replay offline.

## 1. Dump (device pass, as today)
Run the dev replay screen as in `scripts/scan-replay/README.md`. Besides `<id>.json` it now writes to `out/`:
- `<id>.frames.json` — per frame/view: w/h, pitchRad, pass-1 keypoints, refined keypoints, cropRect, candidate flag,
  branch (front: refined|fallback), mask refs; plus `meta`, `groundTruth`, `maskFormat`.
- `<id>.<view>.<i>.mask.bin` — crop mask (crop-square space); `<id>.front.<i>.fmask.bin` — full-frame mask (front fallback only).
- Format: `MASK_FORMAT` in `app/dev-scan-replay.tsx`: `'f32'` (default, raw LE float32, exact, 1 MB/mask) or
  `'u8'` (round(v*255), 4x smaller; loader de-quantises v/255 -> diffs ~1e-5 in normalised units).
Masks are dumped BEFORE any `eraseDisk` (the pure stage clones before erasing).
Dev-only (`__DEV__`); the camera screen passes no `debug`, behaviour unchanged.

## 2. Replay / validate
```bash
deno run -A --sloppy-imports scripts/offline-replay/run.ts --in ./replay-out --validate   # offline vs device <id>.json
deno run -A --sloppy-imports scripts/offline-replay/run.ts --in ./replay-out --out ./offline-out \
  --S '{"chestAt":0.3,"trackTolFrac":0.02}' --K '@k.json'                                   # override constants
deno run -A --sloppy-imports scripts/measure-eval/run.ts --dir ./offline-out --fuse
deno run -A --node-modules-dir=none --sloppy-imports scripts/bench-table/build.ts --csv=... --md=... "set=./offline-out"
```
`--validate` prints per-body max |diff| over keypoints / silhouette / side / est / rawEst vs the device fixture
(f32: expect 0; u8: quantisation level) and flags structural mismatches. Overrides: `S` = silhouetteMath tunables
(threaded as an optional `s` param through extractWidths/extractSideDepths/band scans/maskVerticalExtent — default
`S`, production unchanged), `K` = landmarksToMeasurements tunables (existing `tunables` mechanism).

## 3. Sweep
```bash
deno run -A --sloppy-imports scripts/offline-replay/sweep.ts --in ./replay-out \
  --spec '{"S.chestAt":[0.2,0.35,0.05],"S.trackTolFrac":[0.01,0.03,0.005],"K.hipWidthCorrection":[0.95,1.15,0.05]}' \
  --fields body_bust,body_waist,body_hip --passes 2 [--train odd] [--raw]
```
Coordinate descent on TRAIN (even body ids; numeric id suffix), objective = mean weighted MAE over `--fields`
(fused estimate unless `--raw`); prints default vs tuned for train and held-out. Applies nothing to src.
Not sweepable (module consts): `SIDE_BAND`, `MIN_KP_SCORE`, `Q.*`, `MAX_REFINE_FRAMES`.

## Self-test (no device)
`deno run -A --sloppy-imports scripts/offline-replay/selftest.ts --out <tmpdir>` writes synthetic f32+u8 dumps, checks
f32 round-trip is exact and S overrides take effect; then `run.ts --in <tmpdir>/u8 --validate` works on it.
Memory: sweep keeps all masks in RAM (~5 MB/body at f32).
