# Scan replay — run the REAL scan pipeline on still images (Android emulator)

`app/dev-scan-replay.tsx` (DEV builds only, deep link `mien://dev-scan-replay`) feeds still
photos through `estimateKeypoints` → `processScan` (the exact code the live scan screen
runs) and writes measure-eval fixtures v2 that `scripts/measure-eval/run.ts` scores.
No native rebuild: the existing debug APK + Metro run the JS.

## Body-set layout (local)

```
<set>/<bodyId>/front_0.jpg [front_1.jpg front_2.jpg]   # 1+ images; a single image is reused 3x
              side_0.jpg  [side_1.jpg  side_2.jpg]
              meta.json   {"heightCm":170,"weightKg":65,"sex":"female","ageYears":30,"asianWeight":1.0,"pitchRad":1.5708}
              gt.json     {"body_bust":..,"body_waist":..,"body_hip":..,"body_inseam":..,
                           "body_shoulder_width":..,"body_sleeve_length":..,"body_upper_body_length":..}  # cm, app field names
```
`asianWeight` becomes the fixture's top-level `weight` (weighted MAE). Images must be upright JPEGs.

## Steps (Git Bash, repo root; emulator + `npx expo start` already running, debug app installed)

```bash
S=scripts/scan-replay/push-pull.sh
$S push  /path/to/body-set          # adb push -> /data/local/tmp, then run-as cp -> files/scan-replay/in/
$S open                             # deep link; then tap RUN (or adb shell input tap X Y)
$S wait  <number-of-bodies>         # optional: polls out/_log.txt
$S pull  ./replay-out               # run-as tar of out/ -> ./replay-out/<bodyId>.json + _log.txt
$S eval  ./replay-out               # = deno run --allow-read --sloppy-imports scripts/measure-eval/run.ts --dir ./replay-out --fuse
# add calibration:
deno run --allow-read --sloppy-imports scripts/measure-eval/run.ts --dir ./replay-out --fuse --calibrate
```

Raw equivalents:

```bash
export MSYS_NO_PATHCONV=1
adb push /path/to/body-set /data/local/tmp/scan-replay-in
adb shell "run-as tech.kioh.mien sh -c 'mkdir -p files/scan-replay && rm -rf files/scan-replay/in && cp -r /data/local/tmp/scan-replay-in files/scan-replay/in'"
adb shell am start -a android.intent.action.VIEW -d mien://dev-scan-replay tech.kioh.mien
adb exec-out run-as tech.kioh.mien tar -C files/scan-replay/out -cf - . > out.tar && mkdir replay-out && tar -xf out.tar -C replay-out
```

Notes
- `documentDirectory` (expo-file-system) on Android = `file:///data/user/0/tech.kioh.mien/files/`, i.e. `files/` under `run-as`. Needs a debuggable APK.
- Progress also goes to Metro/logcat as `[SCAN_REPLAY] ...`; per-body timing/refined count/failures in `out/_log.txt` (rewritten after each body).
- Source images are never consumed (frames are decoded to RAM via stillToRgba; processScan zeroes only its in-RAM copies). Re-run freely; `push` wipes `in/` and `out/`.
- A frame where `estimateKeypoints` finds no pose is skipped (the live loop would drop it too); a frame failing the live pose gate is still processed but logged.
- Fixture `replay` block (`est`, `rawEst`, `refinedSuccessCount`, `sideOk`) is diagnostics only; the harness ignores it.
