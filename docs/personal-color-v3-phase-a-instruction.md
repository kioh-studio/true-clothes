# Personal Colour v3 — Phase A implementation instruction

Authored by Fable (design lead) 2026-08-04, for Sonnet execution. Context and
rationale: `docs/personal-color-v3-research.md`. Scope approved by anh Khôi:
face-path đầy đủ. This file is the contract — implement exactly this; where
code reality conflicts, prefer the smallest deviation and note it in plan.md.

Hard constraints (do not violate):
- 100% on-device. No photo bytes leave the device, ever. No new cloud calls.
- TypeScript strict, no `any`. Logic in hooks/pure modules, never in JSX.
- Do NOT change the DB schema or `savePersonalColor` payload in this phase.
- Do NOT touch the manual quiz path's behaviour.
- Pure colour math stays in files with no native imports (Jest-importable),
  following the existing `colorMath.ts` / `analyzePhoto.ts` split.

## A1. colorMath.ts — new pure helpers (+ unit tests)

1. `srgbToLinear(rgb: RGB): {r,g,b}` and `linearToSrgb` — extract the existing
   `lin()` from `rgbToLab` and its inverse; `rgbToLab` keeps behaviour.
2. `subtractAmbient(flash: RGB, ambient: RGB): RGB` — linearize both, per-
   channel `max(0, flashLin - ambientLin)`, delinearize back to 0–255. This is
   the flash/no-flash reflectance isolation (PLOS ONE method).
3. `itaDeg(lab: LAB): number` — `atan2(L − 50, b) · 180/π`.
4. `itaToValueAxis(ita: number): number` — piecewise-linear map of the
   published ITA° bands onto the tone12 value axis in [−1, 1]. Read tone12.ts
   first to get the axis SIGN convention right (which sign means "light");
   anchor points: ITA 65 → full light pole, 55/41/28/10/−30 evenly spaced
   interior knots, −45 → full deep pole. Clamp outside.
5. `chromaC(lab: LAB): number` — `sqrt(a² + b²)`.
6. `scleraGains(scleraPixels: RGB[]): {r,g,b} | null` — mean linear RGB of the
   pixels; gains `g_c = meanLum / mean_c` (meanLum = average of the three
   channel means). Return null (correction refused) if any gain falls outside
   [0.6, 1.6] — a bloodshot/shadowed/blue-lit sclera must not "correct" the
   whole frame off a cliff.
7. `applyGains(rgb: RGB, gains): RGB` — in linear space, clamp to [0,255].

Tests (Jest, `__tests__/colorMath.test.ts` extend): linear round-trip,
subtraction of a known synthetic pair, ITA° of hand-computed LAB values,
band mapping monotonicity, gain refusal outside caps, gain application
neutralizing a synthetically tinted grey.

## A2. faceRegions.ts — NEW pure module

Input: image dims + BlazeFace output (bounding box + 6 keypoints: rightEye,
leftEye, nose, mouth, rightEar, leftEar — reuse the existing try-on BlazeFace
integration; find it under `src/features/try-on/` and import/adapt its types,
do NOT add a new face-detection dependency). Output: pixel-rect regions:

- `cheekRegions`: two rects, each centred laterally between eye and mouth
  keypoints on its side, width 0.22×IOD, height 0.18×IOD (IOD = inter-ocular
  distance), pushed 0.15×IOD outward from the eye-mouth line (toward the ear)
  so it lands on the cheek, not the nose fold.
- `foreheadRegion`: rect spanning between the two eyes horizontally, height
  0.35×IOD, sitting 0.45×IOD above the eye line.
- `eyeRegions`: two rects centred on each eye keypoint, 0.30×IOD × 0.16×IOD
  (sclera candidates come from inside these).
- `hairBand`: the horizontal band of the FULL image above the face bounding
  box top edge (min height 8px; null if the box touches the top).
All rects clamped to image bounds. Pure math — full Jest coverage with a
synthetic keypoint fixture.

## A3. analyzePhoto.ts — analyzeFace()

`analyzeFace(flashUri: string, ambientUri: string | null)` →
```
{ skinLab, hairLab, hueDeg, ita, chroma,      // calibrated metrics
  scleraCorrected: boolean, snrOk: boolean,
  skinConfident: boolean, hairConfident: boolean } | null
```
Pipeline:
1. Downscale BOTH uris to width 192 (keep aspect) via expo-image-manipulator,
   decode with jpeg-js (same pattern as `sampleCentralLabs`).
2. Run BlazeFace on the flash frame (reuse try-on's detector util; if it needs
   a tensor/canvas input adapt at this layer). No face → return null.
3. If ambientUri present: per-pixel `subtractAmbient` across the two frames
   (they're the same size; assume alignment — the capture takes them ~350ms
   apart like the wrist step). Compute SNR = mean linear luminance of
   (flash−ambient) over the face box; `snrOk = snr > 0.015`. If !snrOk,
   discard the subtraction and use the flash frame as-is (outdoor daylight
   case) — record snrOk=false, it is NOT a failure.
4. Sclera: from eyeRegions on the working frame, take pixels in the top 15%
   by linear luminance with C*ab (of their LAB) below the region median;
   need ≥ 12 px, else no correction. `scleraGains` → null-guard →
   `applyGains` to all subsequent sampled pixels. Record `scleraCorrected`.
5. Skin: sample cheek (both) + forehead regions, drop pixels failing
   `isSkinPixelLab` and glare/shadow (reuse the mx 25/245 rule), need ≥ 60 px
   for confident, ≥ 25 to answer at all; average → skinLab; hueDeg, ita,
   chroma from it. `skinConfident` = px count ≥ 60 AND hue margin ≥ 3° from
   both thresholds (same rule as wrist today).
6. Hair: from hairBand, darkest 40% cluster (reuse `darkestFraction`),
   ≥ 20 px; nearest HAIR_OPTIONS swatch with margin confidence (same
   constants as analyzeHairColor). Sparse/absent band → hairLab null,
   hairConfident false (fallback question will catch it).
Everything wrapped: any throw → null (caller falls back like today).

## A4. Capture — FaceScanStep + hook rewiring

- New `FaceScanStep` component (one per screen, matching how WristScanStep is
  duplicated/patterned in `app/(onboarding)/personal-color.tsx` and
  `app/personal-color-edit.tsx`): front `CameraView`, full-height slot like
  the other scan steps. Screen-flash sequence on capture tap:
  1. render a full-screen WHITE overlay (opacity 1) + push screen brightness
     to max via `expo-brightness` (add dependency; restore prior brightness
     in a finally + on unmount), wait ~300ms, take photo #1 (flash frame);
  2. drop overlay to near-black, wait ~350ms, take photo #2 (ambient frame);
  3. `onCapture(flashUri, ambientUri)`. `busyRef` re-entrancy guard like the
     wrist step. Caption: "Bare face, glasses off, hair back if you can.
     Two quick shots — the screen will flash white. Nothing leaves your
     phone." (+ vi translation in both locale files.)
- `usePersonalColorDetection`: camera path becomes
  `face-scan → wrist-scan → (fallback questions) → result`.
  - New step `'face-scan'`; REMOVE `'hair-scan'` from the camera path (hair
    now comes from the selfie's hairBand; the manual `'hair'` question is the
    only fallback). Delete/retire the hair-scan branch in `setCameraPhoto`;
    keep `analyzeHairColor` (edit-screen hair rescan can stay if it's wired
    anywhere else — check before deleting exports).
  - `setCameraPhoto('face', flashUri, ambientUri)` runs `analyzeFace`,
    stores skinLab/hairLab/hueDeg/ita/chroma + confidents, advances to
    wrist-scan immediately (analysis in flight, same pattern as today).
  - Wrist stays the secondary undertone site (it's makeup-free — that's its
    value). Reconcile face-vs-wrist skin reads: agreement on undertone key →
    confident; disagreement → keep FACE read (primary site), confident=false.
    Reuse/adapt `combineWristReads` naming to `combineSkinReads`.
  - Wrist retrofit: inside the existing dual-shot wrist analysis, before
    classification, apply `subtractAmbient` per-pixel when both frames are
    present (new small helper in analyzePhoto reusing the same decode path)
    instead of the current classify-both-and-compare; keep the old
    classify-compare as an additional confidence cross-check.
- iPad/no-torch backlog item (§G) is NOT solved here, but face-scan's screen
  flash works on iPad — note that in the backlog entry as mitigation.

## A5. tone12.ts — axes re-anchor + secondary result

1. Value axis: when photo metrics exist, derive from `itaToValueAxis(ita)`
   (blend with quiz-derived value if both exist: photo 0.7 / quiz 0.3).
2. Warmth axis: unchanged formula but now fed calibrated hue; expose the
   margin (degrees past the 47/57 thresholds, normalized /10, clamp 1).
3. Chroma axis: add skin `chromaC` as a signal alongside the existing
   contrast inputs (read the current implementation and blend photo 0.5 /
   existing 0.5; document the weights inline as CALIBRATION-PENDING—v3).
4. `classifyTone12` returns `{ tone, secondary, confidence }`:
   - `secondary`: recompute with the LOWEST-margin axis sign flipped; if the
     result differs, that's the neighbour tone; null if identical.
   - `confidence`: 'high' | 'medium' | 'low' from the min axis margin
     (≥0.5 / ≥0.2 / else). Thread through `scorePersonalColorDetailed` into
     `PersonalColorResult` (additive fields — existing consumers unaffected).
5. Result screens: under the 12-tone label, when secondary exists show
   `LEANING {SECONDARY LABEL}` in the same `seasonLabel` style; when
   confidence === 'low', surface the existing "REFINE WITH DRAPING" button's
   section with a one-line nudge ("A quick drape session will sharpen this.")
   — reuse existing styles, no new visual language. Persisted payload
   unchanged (secondary/confidence are session-local for now).

## A6. Tests, docs, hygiene

- Jest: all new pure modules covered (colorMath additions, faceRegions,
  tone12 secondary/confidence). Run the personal-color suite + typecheck.
- Update `src/design/personal-color/design.md` (new step, screen-flash UX,
  leaning label) and `plan.md` changelog (Phase A entry, decisions, weights
  marked CALIBRATION-PENDING—v3).
- backlog.md: add "persist secondary/confidence to profiles" (deferred),
  "Phase B draping rebuild" and "Phase C deliverables (full beauty scope
  approved)" as queued items; note iPad mitigation on the §G torch entry.
- Do not commit; leave changes in the working tree for Fable review.
