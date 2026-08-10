# Personal Colour — Device Accuracy Test Protocol

Status: draft protocol for anh Khôi to run by hand on a real phone. Written
2026-08-10, after a first emulator smoke-test of the fallback path (see
"Findings from the emulator smoke-test" below — those findings feed directly
into the "Fix before testing" section).

This file is a **how-to**, not a research summary — see
`docs/personal-color-v3-research.md` for the underlying research (hue
thresholds, ITA° bands, dark-skin error literature) referenced throughout.

Goal: answer, with evidence instead of guesses, "how accurate is the
personal-colour result on a real phone, for a real person?" The three tiers
below are ordered by cost and by how much each one actually bounds the
answer — do them in order, don't skip to Tier 3.

---

## Why three tiers, in this order

- **Tier 1 (repeatability)** costs nothing but time and answers the question
  that bounds every other question: *if the same person, same lighting, gets
  scanned twice, do they get the same tone?* If not, no amount of expert
  comparison in Tier 3 can make the app "accurate" — the ceiling on accuracy
  IS the repeatability rate. A tool that's wrong consistently can be
  recalibrated; a tool that's random cannot.
- **Tier 2 (ColorChecker)** costs ~$60–80 and answers "is the camera/maths
  pipeline reading colour correctly at all?" — independent of whether MIEN's
  season/tone classification rules are the right rules. This separates two
  very different bugs: *bad pixels in* vs *bad rules applied to good pixels*.
- **Tier 3 (expert consensus)** costs the most (needs 20–30 people and access
  to a real colour analyst) and answers the actual product question — "does
  this match what a professional would say?" — but it's meaningless to run
  before Tier 1 passes, because you can't tell a real disagreement from scan
  noise.

---

## Fix before testing

Found during the 2026-08-10 emulator smoke-test of the camera-fallback path
(details in the report that shipped with this file). These block Tier 1 from
being *rigorous* — Tier 1 can still start today in a reduced form (see the
tier's own note), but the full version needs these first.

1. **No diagnostic data ever leaves the hook.** `usePersonalColorDetection`
   computes `skinHueDeg`, `faceSnrOk`, `faceScleraCorrected`,
   `skinConfident`/`hairConfident`, and `analyzeFace`/`analyzeWristUndertone`
   compute `ita`, `chroma` — none of this is logged, shown on screen, or
   persisted. `savePersonalColor` (src/stores/authStore.ts) only writes
   `season`, `palette`, `tone12` to Supabase. Only **tone12 and season** are
   recoverable today (tone12 IS shown on the result screen — see Tier 1
   below), everything else needs temporary instrumentation before it can be
   recorded. See Tier 1's "how to actually get the numbers" for the smallest
   fix that unblocks this.
2. **`takePictureAsync` calls in `app/(onboarding)/personal-color.tsx` are
   not individually wrapped in try/catch** (both `FaceScanStep.handleCapture`
   and `WristScanStep.handleCapture` — already tracked in `backlog.md`).
   The emulator smoke-test could NOT reproduce a hang because the emulator's
   camera never rejected the capture call — both shots always resolved (they
   just decode to garbage, which is the intended fallback path, and that part
   works). This means the hang is still **unverified, not ruled out**. On a
   real phone, capture can genuinely reject (camera taken by another app,
   app backgrounded mid-shot, permission revoked mid-session) — if that
   happens during Tier 1/2/3 field testing, the screen will freeze on the
   camera step with no error and no way forward except restarting the app.
   Testers should watch for this specifically and report "app frozen on
   camera screen, no crash" as this bug, not as "scan is slow."
3. Not a code bug, but a testing-environment gotcha worth knowing: on a dev
   build, LogBox/RevenueCat warning toasts can render on top of the shutter
   button and swallow taps meant for it (this happened during the emulator
   test — the capture button was untappable until the toasts were dismissed
   by tapping their own [x]). If a tester says "the shutter button doesn't
   respond," check for a toast sitting on top of it before assuming a capture
   bug.

---

## Tier 1 — Repeatability (do this first, costs nothing)

### What to do

Same person, standing in the same spot, repeats the full scan:

- **N = 5 repeats** per lighting condition (5 is enough to see if answers
  cluster or scatter; more is better if you have patience)
- **M = at least 3 lighting conditions**, each meaningfully different:
  1. Beside a window, daytime, no direct sun (soft daylight)
  2. Indoor, warm/yellow bulb light, window shades closed (worst case — this
     is the condition the app's own "prepare" checklist tells users to avoid,
     so it's also the condition most likely to reveal what happens when a
     user ignores that advice)
  3. Outdoors, direct sunlight (harsh, high-contrast — also the case the
     research doc flags as "the screen flash barely registers" → `snrOk`
     should read false here, worth confirming)

That's 5 × 3 = 15 scans minimum for one person. If time allows, repeat the
whole matrix on a second person with visibly different (tan/brown) skin —
the research doc is explicit that error rates are reported 2–10× higher on
darker skin, so a same-person-only test on light skin will under-report the
real-world problem.

### What to record each time

| Field | Where it comes from | Recoverable today? |
|---|---|---|
| `tone12` (12-tone name, e.g. "True Spring") | Result screen headline (`result.label`) | **Yes — on screen** |
| `season` (4-season parent) | Result screen subtitle text | **Yes — on screen** |
| hue angle (°) | `state.skinHueDeg` in the hook | No — needs temp logging |
| ITA° | `analyzeFace`'s return value | No — needs temp logging |
| `skinConfident` / `hairConfident` | hook state | No — needs temp logging |
| `faceSnrOk` (screen-flash signal strong enough to use) | hook state | No — needs temp logging |
| `faceScleraCorrected` (white-balance correction applied) | hook state | No — needs temp logging |
| Which path landed (auto-read vs fallback question shown) | Whether `SkinStep`/`HairStep` render the "WE COULDN'T READ THAT CLEARLY" fallback banner | **Yes — on screen** |

### How to actually get the numbers that aren't on screen

Two options, in order of effort:

**Option A — reduced Tier 1, no code change (do this today).** Record only
the 3 fields marked "Yes — on screen" above. This already answers the
single most important question: *does the same person in the same light get
the same season/tone twice?* It also tells you the fallback-rate — how often
the camera path silently degrades to the manual questions — which is itself
a meaningful number (a high fallback rate on real phones would mean the
camera path barely matters in practice).

**Option B — full Tier 1, needs ~10 minutes of temporary code.** Add one
`console.log` at the end of `analyzeFace` in
`src/features/personal-color/analyzePhoto.ts` (right before its `return`
statement, logging `{ hueDeg, ita, chroma, snrOk, scleraCorrected,
skinConfident, hairConfident }`), and read it live from the dev-build
terminal (`npx expo start`) or via `adb logcat ReactNativeJS:V *:S` while
running the scan on the connected phone. This is a **temporary, throwaway
change for the test session only** — revert it afterward (or ask whoever
runs the test session to do so before committing anything else). Do not
leave debug logging of skin-tone data in a shipped build.

### Recording sheet (copy this table, fill one row per scan)

| # | Lighting | tone12 | season | fallback shown? (skin/hair/neither) | hue° | ITA° | snrOk | scleraCorrected | notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | window daylight | | | | | | | | |
| 2 | window daylight | | | | | | | | |
| 3 | window daylight | | | | | | | | |
| 4 | window daylight | | | | | | | | |
| 5 | window daylight | | | | | | | | |
| 6 | warm indoor bulb | | | | | | | | |
| 7 | warm indoor bulb | | | | | | | | |
| 8 | warm indoor bulb | | | | | | | | |
| 9 | warm indoor bulb | | | | | | | | |
| 10 | warm indoor bulb | | | | | | | | |
| 11 | outdoor sun | | | | | | | | |
| 12 | outdoor sun | | | | | | | | |
| 13 | outdoor sun | | | | | | | | |
| 14 | outdoor sun | | | | | | | | |
| 15 | outdoor sun | | | | | | | | |

### How to read the results

- Count distinct `tone12` values per lighting condition. All 5 the same =
  perfectly repeatable in that light. 3+ distinct tones out of 5 = the tool
  is closer to random than measuring anything, in that light.
- Compare fallback rate across lighting conditions — if the camera path
  degrades to manual questions far more often in warm indoor light than
  daylight, that's the `snrOk`/hue-margin gating doing its job (or being too
  conservative — can't tell which without Tier 2).
- **This tier's number is a ceiling, not a target.** If same-person same-light
  repeatability is, say, 60%, then no combination of Tier 2/3 fixes can make
  the shipped product's real-world accuracy exceed ~60%, because the
  variance is coming from the capture/lighting sensitivity, not from wrong
  classification rules.

---

## Tier 2 — Colour accuracy via ColorChecker

### What you need

An X-Rite/Calibrite ColorChecker Classic (24-patch), roughly $60–80. Cheaper
alternatives (Pantone SkinTone Guide, ~110 chips, mentioned in the research
doc) work too but the 24-patch Classic is the more standard reference and
has widely published LAB values to compare against.

### What to do

1. Hold the ColorChecker card where the face/wrist would normally go during
   a scan, and run it through the app's **actual capture flow** — same
   camera screen, same screen-flash sequence, same button. Do not photograph
   it separately and import the photo; the whole point is testing the app's
   own pipeline (decode → sample → LAB → whatever correction is applied),
   not testing a generic camera.
2. Using the same temporary logging from Tier 1 Option B, record the LAB
   value the app computed for each patch it sampled.
3. Compare against the ColorChecker's published LAB values (printed on the
   card's reference sheet, or in X-Rite's published dataset) using ΔE2000
   (standard perceptual colour-difference formula — any online ΔE calculator
   or a five-line script works).

### Why this tier matters even if Tier 1 looks fine

Tier 1 can look perfectly repeatable and still be wrong — if the pipeline
consistently reads "peachy tan" as "cool pink" due to a camera/AWB/gain bug,
every repeat will agree with the *previous wrong reading*, not with the
truth. Tier 2 is what tells you the readings are actually correct, not just
consistent. A large ΔE on every patch points at the capture/maths pipeline
(camera colour science, the sclera correction, the flash/ambient
subtraction); a small ΔE with wrong seasons still coming out points at the
season/tone **classification rules** (the hue thresholds noted below) —
these need different fixes.

### Numbers already flagged as "not yet validated" in this codebase

Worth checking these specifically once you have real LAB readings:

- Hue-angle thresholds of **47° (cool) / 57° (warm)** in `colorMath.ts`
  (`classifyUndertone`) are marked `CALIBRATION-PENDING` in the source — they
  were guessed, not derived from the ColorChecker or a published source.
  Tier 2 data can tell you whether real skin-tone patches land where these
  thresholds expect them to.
- ITA° bands (`>55 very light … <−30 dark`) ARE published/clinical
  thresholds (cited in `docs/personal-color-v3-research.md` §2) — these are
  less likely to be wrong, but worth confirming the app's ITA° computation
  matches the formula (`arctan[(L*−50)/b*]·180/π`) once you have ground-truth
  LAB to feed it.

---

## Tier 3 — Expert consensus

### What to do

Recruit **20–30 people**, and this is the one hard requirement: **make sure
a meaningful fraction have tan/brown/dark skin, not just light skin.** The
research doc (`docs/personal-color-v3-research.md` §2) is explicit that
published error rates run 2–10× higher on darker skin tones for both camera
hardware and classification algorithms — a test panel that's accidentally
all light-skinned will not catch the failure mode most likely to actually
matter.

For each person:
1. Run them through the app's camera-path scan (ideally after they've
   already passed Tier 1's "does this even repeat" bar informally — no
   point comparing a coin-flip to an expert).
2. Get the same person evaluated by an actual colour analyst/colourist using
   traditional draping (the professional methodology described in
   `docs/personal-color-v3-research.md` §2 — comparative fabric pairs,
   N-daylight, bare face).
3. Record both results (app tone12/season vs colourist's season/tone) and
   compute agreement rate — ideally split the agreement rate by skin tone
   (light vs tan vs dark) so a hidden dark-skin failure doesn't get averaged
   away by a majority-light-skin panel.

### What "good" looks like

There's no universal bar, but the research doc notes competitor apps
self-report 60–82% agreement with a pro. Beating or matching that on the
*light-skin* subset while badly trailing it on the *dark-skin* subset would
be a specific, actionable finding — worth explicitly checking for rather
than only reporting one blended number.

---

## Findings from the emulator smoke-test (context, not a substitute for the above)

A same-day emulator run confirmed the **mechanism** works — capture →
analysis-fails-silently → fallback question → result → save all completed
without a crash or hang, on `emulator-5554`'s synthetic camera feed (which
cannot produce a real face, so this only proves the fallback plumbing, not
accuracy). It does NOT substitute for any tier above: an emulator's fake
camera image tells you nothing about accuracy, lighting sensitivity, or the
takePictureAsync-rejection hang risk noted in "Fix before testing" above.
