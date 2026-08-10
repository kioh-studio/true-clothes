# Personal Colour v3 — Research Synthesis & Upgrade Proposal

Date: 2026-08-04. Status: **PROPOSAL — awaiting anh Khôi's approval** (see
backlog.md §A). Research gathered by 3 parallel Sonnet agents (market apps /
professional draping methodology / phone-camera technical feasibility); full
reports live in the session transcript — this file is the durable synthesis.

Hard constraint carried over: **all analysis stays on-device** (no photo ever
leaves the phone, no cloud AI) — matches the "body data on-device only" rule.

---

## 1. Verdict

Yes — the professional methodology CAN be approximated on a normal phone, and
MIEN's existing skeleton (12-tone, 3-axis warmth/value/chroma, LAB math,
dual-flash capture, drape refinement) is already the correct architecture.
The market's 12-season system == our tone12. What's missing is (a) the face
(we only measure the wrist), (b) principled colour calibration, (c) a
draping UX that teaches the user to judge like an analyst, and (d) richer
deliverables (metals/makeup/wow-colors). All four are achievable with
expo-camera + the face-landmark stack already in the repo (BlazeFace from
try-on) — no native module required for the recommended scope.

## 2. Key research findings (condensed)

### Market (consumer apps)
- 12-season is the de-facto standard; 4-season apps are criticized as
  oversimplified. Nobody credible ships 16-season in-app.
- Trust-building UX winners: (1) real-time virtual draping (colour washed
  over the live face), (2) side-by-side grids — one selfie rendered against
  all 12 season drapes at once, (3) manual override / colour-picker fallback.
- Nearly all "AI" apps are black boxes; self-reported accuracy 60–82% vs a
  pro; universal weaknesses: lighting sensitivity, darker skin tones, no
  makeup-removal instructions (pros always require bare face).
- **Nobody surfaces confidence or "between two seasons"** — documented market
  gap we can own (our axes model already has margins internally).

### Professional draping methodology
- Environment: N-daylight or D65 5000–6500K, bare face, neutral cape, hair
  back, neutral walls. Everything is COMPARATIVE pairs, never one colour
  alone: tomato-vs-cherry red, mustard-vs-lemon, olive-vs-emerald,
  orange-vs-fuchsia (warm/cool); light-vs-dark (value); clear-vs-dusty
  (chroma); gold-vs-silver lamé (undertone confirm).
- What the analyst actually judges (teachable to users as prompts): under-eye
  shadows soften vs deepen, jawline definition, eye/teeth brightness, skin
  evenness — NOT "which do you like".
- Deliverables: 30–60 colour fan, 3–6 "wow" colours, worst-colours list
  (practitioners say the avoid-list is the most actionable half), seasonal
  neutrals, colour-pairing rules, makeup families per season, hair-colour
  direction, metals (warm→gold/bronze, cool→silver/platinum, neutral→both),
  glasses-frame colours, capsule-wardrobe coaching.
- Reliability: undertone (warm/cool) is the MOST subjective axis even between
  pros; value is the most stable; chroma the most refined. Korean system
  decides warm/cool first; Sci\ART weighs 3 axes co-equally (our model is
  Sci\ART-shaped — keep it).

### Technical (normal phone, on-device)
- Phone AWB is the enemy: uncorrected LAB is not comparable across shots or
  devices. expo-camera has NO manual AWB/ISO; full manual control would need
  vision-camera/native. Workarounds that need no native module:
  - **Flash/no-flash subtraction** (PLOS ONE, validated): two frames, flash
    minus ambient isolates flash-lit reflectance → ambient illuminant
    cancelled. ~2.4× accuracy gain vs metadata correction. We already take
    the two wrist shots — but we only compare classifications; the real
    technique subtracts linearized RGB per-pixel. Front camera: use the
    SCREEN at full white brightness as the flash.
  - **Sclera as in-image white reference** (published, validated on neonatal
    jaundice screening): the white of the eye reflects the illuminant → use
    it for white-balance correction in a selfie. Zero hardware, perfect fit
    for a face path.
- **ITA° = arctan[(L*−50)/b*]·180/π** — the one clinically standard skin
  metric. Bands: >55 very light, 41–55 light, 28–41 intermediate, 10–28 tan,
  −30–10 brown, <−30 dark. Captures VALUE only (ignores a*) — undertone must
  come from hue angle/a*-b* balance (what we already do). Use ITA° to anchor
  the value axis with published thresholds instead of guessed constants.
- Landmark-polygon sampling (cheeks/forehead/jaw, excluding brows/lips/
  specular pixels) is what published smartphone-ITA studies used and is
  sufficient — full face-parsing segmentation (BiSeNet ~14–56MB + ONNX
  runtime + prebuild) is NOT needed for v3.
- Consistent hard finding: error/variance rises 2–10× on darker skin (both
  algorithms and camera hardware). Mitigation: confidence surfacing + manual
  fallback, and validation fixtures must include tan/brown skin.
- Validation ground truth: X-Rite/Calibrite ColorChecker Classic (24 patch)
  or Pantone SkinTone Guide (110 chips) photographed through the app's own
  capture flow, recovered LAB vs published values.

## 3. Gap analysis vs current implementation

| Area | Current (v2) | Research says |
|---|---|---|
| Sample site | Wrist only (+hair) | Face, multi-zone (cheeks/forehead/jaw) — the face is what draping judges |
| Calibration | Dual-flash = compare 2 classifications | True per-pixel flash/no-flash subtraction; sclera white-reference |
| Value axis | Guessed constants (CALIBRATION-PENDING) | Anchor on ITA° published bands |
| Draping | 3 generic rounds, tiny colour panels, "looks fresher?" | Same-hue comparative pairs + gold/silver round + specific judge-prompts (shadows/jawline/teeth) |
| Result certainty | Binary confident flags, single tone | Margin-based "between two tones" secondary result (market gap) |
| Output | 26 palette + avoid list + seasonal edit | + wow colours, metals, pairing rules, makeup families, hair direction, glasses |
| Validation | None | ColorChecker fixture protocol |

## 4. Proposed v3 design (recommendation)

**Phase A — capture & math hardening** (biggest "sát thực tế" gain)
1. Face-selfie path: front camera → BlazeFace landmarks (already in repo) →
   cheek/forehead polygon sampling with brow/lip/specular exclusion → LAB.
2. Sclera white-reference correction (diagonal/von-Kries) applied before any
   classification.
3. Screen-flash dual capture (white screen = known illuminant) with real
   linearized-RGB subtraction; retrofit the same subtraction to the wrist
   torch path. SNR floor → "retake" prompt.
4. Re-anchor axes: value ← ITA° bands; warmth ← hue-angle/a*-b* (keep);
   chroma ← C*ab + skin-hair-eye contrast. Replace guessed constants with
   documented thresholds.
5. Confidence model: per-axis margins → primary tone + optional "leaning
   {neighbour}" secondary; low margin routes to drape session instead of
   pretending certainty.

**Phase B — draping UX rebuilt on pro methodology**
6. Comparative same-hue pairs (tomato/cherry, mustard/lemon, olive/emerald)
   + gold-vs-silver lamé round; per-round prompts teach the analyst's
   criteria ("which softens the shadows under your eyes?").
7. 12-tone grid: selfie framed against each tone's signature drape colour,
   side-by-side; tap-to-compare before/after. (Static images — no realtime
   AR face-tinting; that would need GPU filters for marginal gain.)
8. Manual quiz stays as fallback (vein/jewelry/sun) — privacy-friendly path
   and low-confidence rescue.

**Phase C — deliverables & engine wiring**
9. Per-tone data: 3–6 wow colours (subset of accents), metal (gold/silver/
   both), pairing rules, makeup families (lip/blush/eye), hair direction,
   glasses frames. Wire metals into outfit-engine accessory scoring.
10. Validation: buy a ColorChecker Classic (~$60–80), fixture protocol
    (capture card through the app flow, assert recovered LAB within band),
    plus tan/brown-skin test photos. Retire "CALIBRATION-PENDING" for real.

## 5. Open trade-offs (need anh Khôi's decision before implementation)

1. **Capture scope**: full Phase A face path vs math-hardening only on the
   existing wrist path first.
2. **Phase C content**: include makeup/hair/glasses (beauty territory,
   curation-heavy) or fashion-only outputs (metals, wow, pairing) for now.
3. **ColorChecker purchase** for the validation fixture (small cost, needs
   a physical buy).
