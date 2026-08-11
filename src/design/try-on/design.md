# Try On — Visual & Interaction Spec (feature 008)

Source of truth for the Try On flow UI. Layout follows the "True Clothes Try On"
v2 reference; criteria/content follow `specs/008-try-on/spec.md` (five criteria,
not the mock's three). All screens use `src/design/tokens.ts` only.

## Screens

### Scan (`ScanScreen`)
- Large serif headline, eyebrow `TRY ON`, caption. Primary "TAKE A PHOTO",
  secondary "CHOOSE FROM LIBRARY". Progress + recoverable error/upgrade banners.
- **Profile-completeness note** (before scan): a subtle hairline card appears only
  when the user is missing measurements, selected styles, or preferred colours —
  the inputs the wardrobe-match verdict compares against. The copy makes clear the
  user **can still scan now**, but the verdict will be *approximate* until those
  pieces are added ("The more you add, the sharper the read") — scanning is never
  blocked. Tapping (`COMPLETE PROFILE →`) routes to the first missing section
  (`/measurements-edit` → `/styles-edit` → `/colors-edit`). Hidden once all three
  are present, keeping the screen uncluttered for complete profiles.

### Scan Result (`ResultScreen`)
Single scrolling screen, in order:
1. **Item on white** (`ItemOnWhite`) — AI-isolated cut-out on a pure-white ground
   (`#FFFFFF` is structural here, not a token, matching the product-shot intent).
2. **Identity** — serif name + uppercase brand.
3. **Attribute grid** — 2-col hairline grid: category, color, material, fit,
   season, pattern.
4. **Estimated measurements** — `ESTIMATED MEASUREMENTS` label + a 2-col grid of the
   type-relevant garment measurements, **editable** via `MeasureField` (cm; `EU` for
   shoes). Pre-filled server-side using the user's own body as a scale when the photo
   shows them wearing the item; the user can correct any value or fill blanks. Hidden
   for accessories. Directly below the grid sits the inline **`MeasurementAIMap`** field
   (feature 009): an `AI MAPPING MEASUREMENT` text box where the user pastes one size's
   raw shop measurements (any naming/language/unit). On `MAP WITH AI`, Gemini maps them
   onto canonical `m_*` keys and auto-fills the grid; a short summary shows what was
   filled (with conversion notes like `×2 from flat`) and what wasn't. Every field
   commit AND every AI map calls `applyMeasurements()` in `tryOnStore` (full-replace),
   which re-runs `evaluate()` so the Verdict's Measurement criterion updates immediately.
5. **Mix & match CTA** — full-width `T.color.primary` block with hairline icon
   frame, serif title, and outfit count when known. Subtitle states:
   - While prefetch loads: `"Finding outfits from your closet…"`
   - Once loaded: `"X strong matches · Y outfits from your closet"` (X = high-scoring
     outfits ≥0.70, Y = total outfits returned).
   - Fallback (no prefetch yet): existing generic copy.
6. **Verdict** (`VerdictPanel` → five `DimScore` rows) — overall score +
   recommendation label; each criterion shows a score bar + explanation, or
   "Not enough info" + a link to the relevant profile section when unavailable.
   - **Partial scoring is the norm**: the server scores every criterion it *can*
     (weights renormalised over the available ones) and shows an overall /100 from
     whatever data exists — the more profile data, the more criteria contribute.
   - **All-unavailable empty state** (no criterion scoreable — e.g. an item with no
     detected attributes scanned against an empty profile): instead of a dead end,
     the panel shows a reassuring prompt ("We couldn't score this against you yet…")
     plus a `COMPLETE PROFILE →` link that routes to the most impactful missing
     section (measurement/fit → `/measurements-edit`, else `/styles-edit`, else
     `/colors-edit`). The user is never stranded without a next step.
   - **Wardrobe fit section** (`WardrobeFitRow`) — after the 5 criteria, separated by
     a hairline divider, a `STYLES WITH YOUR CLOSET` micro-label (type.ui 10 tertiary),
     and a `WardrobeFitRow`: `WARDROBE` label (same style as DimScore) + high-match
     count + "matches" unit; 3 px track bar (barPct = min(1, highCount/3)×100);
     explanation line. Visible only when the background prefetch has started (loading
     or results present). NOT part of the server /100 score; visually separated by the
     divider and sub-label. Loading state shows an empty track + italic hint text.
   - **Fit note** — under the bars, separated by a hairline rule: a `FIT NOTE` /
     `ĐÁNH GIÁ ĐỘ PHÙ HỢP` micro-label + an AI-written, grounded note (conclusion +
     "Fits / Watch out" points) to aid the buy decision. Localised EN/VI. Hidden
     entirely when absent (LLM unavailable / rate-limited / errored) — the scores
     never wait on it. See `plan.md` for the generation flow.
7. **Sticky decision bar** — `ADD TO WARDROBE` primary + underlined "Not for me"
   (discard). After Add, a centered success card ("Added to your wardrobe" +
   `VIEW WARDROBE`) overlays the screen.

### Mix & Match (`MixMatchFeed` → `MatchFeedCard`)
- Full-bleed vertical swipe pager (Home-feed feel), one outfit per page.
- Each card: a collage with the scanned item **framed and tagged `CONSIDERING`**
  as the anchor, surrounded by up to three owned wardrobe cut-outs; a large serif
  `MATCH SCORE`; a serif title; a one-line rationale; and a thumbnail strip
  (candidate, then `+`, then the closet pieces).
- Floating top overlay: round back chip + `MATCHING / <item>` chip. Vertical page
  dots on the right. Bottom "BACK TO RESULT" bar.
- States: loading ("Building outfits around this…"), recoverable error (retry),
  and sparse ("Nothing to pair yet") when the wardrobe can't complete an outfit.

## Motion & tone
Slow, intentional. No bouncy animation. Hairline strokes; full-bleed imagery;
near-monochrome base with the user's palette only as accent. Decision scrim uses
a low-opacity warm-black wash.

## Navigation entry (bottom nav)
The global `BottomNav` is now four equal-weight hairline tabs:
**Home · Wardrobe · Scan (camera) · Profile** — no floating center button.
- The previous black circular "⋯" center button (which opened the menu sheet)
  was removed. The menu now lives as a hamburger (`IconMenu`) in the Home
  header, beside the bell.
- The **Scan** tab is the direct entry to Try On: it pushes `/try-on`
  (`ScanScreen`), which previously was only reachable from the Options menu.
- `ScanScreen` is a pushed stack screen (`headerShown: false`), so it carries
  its own close (`IconX`, top-right) for an explicit way back.

## Mix & Match → "See it on you" (2026-07-03)

Each Mix & Match card's thumbnail strip ends with a hairline-bordered micro
action **SEE IT ON YOU** (right-aligned, 9px ui caps). It opens the existing AI
try-on screen (`/try-on/wear`) with the outfit's OWNED item ids as the outfit
payload and the scanned candidate as an `extra` garment param — the candidate
has no cloud photo yet, so the generator receives it as a text-described piece
(type/color/material/fit) while owned pieces keep their signed image URLs.
The wear screen's ITEMS stat counts the candidate. No new chrome elsewhere;
credit gating and the photo flow are unchanged (shared `useWearOnYou`).

## Wear-on-you coverage — build flows (2026-07-03, đợt 2)

- **Build around an owned item** (item detail → pin → Mix & Match): the same
  SEE IT ON YOU action applies, but the pinned piece now travels by its REAL
  wardrobe id (`ScannedItem.sourceItemId`) so the generator receives its actual
  cloud photo instead of a text description; context label reads FROM CLOSET.
- **Build an Outfit (manual canvas)**: when ≥2 pieces are picked, a
  SecondaryButton SEE IT ON YOU sits above SAVE OUTFIT and opens `/try-on/wear`
  with the canvas selection (all real wardrobe ids — full image fidelity).

## Wear-on-you — "Your Frame" card, detail measurements + add-measurements CTA (2026-07-07)

The `YOUR FRAME` hairline card (`wear.tsx`, hidden once `phase === 'result'`)
now shows more than height/weight/items:

- **Height/weight/items row** — unchanged, three equal-width columns.
- **Detail measurement grid** — below the row, a compact wrapped grid
  (`flexWrap`, ~3 columns) of every detail measurement the user has filled in
  (chest, waist, hips, shoulder, sleeve, torso, upper arm, neck, inseam, thigh,
  rise, foot length, foot width), each as a `miniLabel` (9px uppercase
  tertiary) + serif value ("`NN cm`"). Fields with no value (≤0/absent) are
  simply omitted — no "—" placeholders, keeping the grid dense only with real
  data. `bodyShape` and `preferredFit`, when set, append as two more entries
  in the same grid (translated label, e.g. "Hourglass" / "REGULAR").
- **Sparse state** — when the three girths that drive drape most (chest,
  waist, hip) are ALL missing, the grid is replaced entirely by a one-line
  caption ("Add your chest, waist & hip measurements for a more accurate
  try-on.") and a `SecondaryButton` ADD MEASUREMENTS, routing to
  `/measurements-edit`. The grid never renders near-empty.
- **Soft nudge** — when some (not all) detail fields are present, a subtle
  underlined `TextLink` ("Update measurements", tertiary color, no arrow)
  appears under the grid, same route. Intentionally low-emphasis — it never
  competes visually with the sparse-state CTA or the generation actions below.
- Purely a display upgrade — the generator already receives every filled
  detail measurement via `profile.measurementsCm` regardless of what the card
  shows; this only makes visible what was already being sent.

## Generation prompt — studio background + exact-frame proportions (2026-07-07)

`tryon-generate`'s `buildGenPrompt` (server-side, edge function) no longer tells
Gemini to keep the uploaded selfie's original background. Two prompt-only
changes, no client/UI change:

- **Studio backdrop**: the render now REPLACES the source photo's background
  entirely with a clean, seamless studio backdrop — smooth warm-neutral /
  off-white / soft stone-grey wall, evenly lit, editorial-fashion-studio tone
  (matches the app's luxury-minimalism aesthetic). Clutter, rooms, outdoor
  scenery, and objects from the original photo are removed; only the person
  stays. The person's pose/body/face/skin/hair/identity are still preserved
  exactly — only the environment changes, relit with soft even studio light
  and realistic contact shadows on the floor.
- **Exact-frame proportions**: the "stature/proportions" requirement was
  tightened to explicitly bind the render to the PERSON PROFILE's exact
  height, weight, body shape, AND every listed body measurement
  (chest/waist/hip/shoulder/inseam/etc.) — silhouette, girth, and limb length
  must reflect the real user's frame, not an idealised/average fashion-model
  body. Parts not visible in the source photo still extrapolate from height +
  inseam. `profileLines`/payload and the derived BMI/leg-proportion cues are
  unchanged.
- The outfit-context caveat no longer forbids changing the background (since
  that's now intentional) — it still forbids adding props, extra people,
  text, or any scenery beyond the plain studio backdrop.

## Generation prompt — height-flattering editorial framing (2026-07-07)

Renders were reading "short/stumpy" — a framing/camera problem, not a body-
proportion one. `buildGenPrompt` gained one new "Strict requirements" line,
placed right after STATURE/PROPORTIONS:

- **FRAMING & CAMERA**: composes as a full-length, head-to-toe editorial
  fashion shot (whole body + both feet visible, a little headroom); camera at
  roughly waist-to-eye level, straight-on or a slightly LOW angle — never
  looking down at the person (which foreshortens and shortens); upright,
  elegant posture with a long, clean, elongated leg line and the vertical
  proportions typical of a fashion editorial, so the person reads tall and
  statuesque.
- The STATURE/PROPORTIONS line was appended with a reconciling clause:
  "present that real frame with the flattering editorial framing described
  below." Truthful body girths/proportions from the PERSON PROFILE are
  unchanged — only camera placement, framing, and posture are more flattering.
  No client/UI change; server-side prompt only.

## Try-on generation — face-identity lock, softened reframe (2026-07-07)

Critical regression: the two changes above (studio background swap + camera
re-angling for a flattering full-length shot) combined to make Gemini
regenerate the whole person from scratch on many renders, and the first thing
lost was face identity — generated images showed a different face than the
uploaded selfie. Fix, prompt-only, no client/UI change:

- **Face identity is now the #1, absolute "Strict requirements" bullet**,
  ahead of background/framing/proportions: same facial features, bone
  structure, eyes, nose, mouth, jawline, skin tone, hair, hairline — do not
  regenerate/redraw/beautify/slim/re-age the face. States explicitly that if
  preserving the face conflicts with any other instruction, preserving the
  face wins.
- **Removed the camera-angle change** (the main culprit): the
  "FRAMING & CAMERA" bullet no longer tells the model to shoot from a
  "slightly LOW angle" or otherwise re-angle the camera/head — that's what
  forced whole-person regeneration. Renamed to "FRAMING & COMPOSITION" and
  now explicitly says to keep the head/face at the same angle, orientation,
  and lighting as the source photo — no turning, tilting, re-posing, or
  re-lighting the face.
- Height-flattering is kept, but via body posture and full-length framing
  only: upright elongated posture, long clean leg line, whole body + both
  feet visible with a little headroom — never by altering the face or head
  angle.
- The studio-background bullet gained a reaffirming clause: replacing the
  environment must leave the person's face and head exactly as in the source
  photo.
- Net priority order in the prompt is now unambiguous: (1) exact same
  face/identity, (2) faithful garments, (3) truthful body proportions from
  PERSON PROFILE, (4) full-length flattering posture/framing, (5) studio
  background — with face preservation dominating any conflict.

## Try-on generation — face-safe height elongation (2026-07-07)

Without the low-camera-angle trick, renders read short again. Rather than
touching the camera/head, the "FRAMING & COMPOSITION" bullet in
`buildGenPrompt` was strengthened to gain height purely through BODY
composition, kept far from the head:

- **Tall vertical framing**: full-length shot in a tall vertical/portrait
  frame (not square, not waist-up), feet at/near the bottom edge with only
  minimal headroom, so the body fills the frame edge-to-edge.
- **Elongated leg line**: long legs and an elongated lower body as the
  dominant vertical element, the way high-fashion editorial photography
  stretches stature, for a tall, statuesque silhouette.
- **Upright, stretched posture**: spine long, shoulders back, standing tall
  — no slouching, no bent knees that shorten the leg line.
- **No foreshortening/compression**, and no high/downward viewpoint on the
  body that would shorten it.
- **Explicit reconciliation clause**: all of the above applies only to the
  body/legs/posture/vertical framing — the head and face stay at the exact
  source angle/orientation/rendering; no turning, tilting, re-posing,
  re-lighting, or vertically stretching the face/head, and no camera-angle
  change on the head. If there's ever a conflict, the face rule (still the
  #1, first-listed bullet) wins.
- Truthful proportions are unchanged: elongating the leg line/posture is a
  height/leg-length flattering device, not a body-type change — a heavier or
  shorter build must not be rendered as thin.
- Verify: `deno check` — same 3 pre-existing `MinimalClient` TS2345 errors
  (lines 365/379/385), no new errors. Deployed via
  `npx supabase functions deploy tryon-generate` (JWT verification
  unchanged, no `--no-verify-jwt`). No client/UI change; server-side prompt

## Face compositing (identity guarantee) — 2026-07-07

The prompt-side face-identity lock above reduces drift but cannot guarantee
it — the model still free-hand renders the face. This adds a deterministic,
on-device second layer: after generation, the user's REAL face (from the
already-uploaded/validated source photo) is detected, aligned, and pasted
onto the generated image, replacing whatever face the model rendered.

No new screens/states — this is invisible plumbing inside the existing
`rendering → result` transition in `useWearOnYou`. What the user perceives:

- The photo shown on the **Result** screen (`photoZone` in `app/try-on/
  wear.tsx`) is either the composited image (real face) or, on any failure,
  the model's raw generated image — the SAME loading state
  (`wearOnYou_generating`) and result badge as before either way. No visual
  or timing difference is intentionally exposed to the user; compositing
  adds on-device processing time to the existing "rendering" spinner, not a
  new step.
- Nothing changes in the invalid/error/credit-blocked states — those are all
  upstream of generation.

Pipeline (implementation in `src/features/try-on/faceDetect.ts`,
`faceCompositeMath.ts`, `faceComposite.ts`): BlazeFace short-range detects 4
landmarks (eyes/nose/mouth) in both the source photo and the generated
image → a least-squares similarity transform aligns source→generated face
space → a feathered inner-face ellipse mask (excludes hairline/jaw, so the
model's hair/head-shape/background lighting are untouched) → the source
face is color-matched (mean/std transfer) to the generated lighting → alpha-
blended in.

**Fallback, always silent to the user**: no face detected in either image,
an implausible alignment (very different head angle/scale — e.g. the source
photo is a profile shot but the generated pose is frontal), or any decode/
encode error → the raw generated image is used as-is, exactly the
pre-existing behaviour. The user is never shown an error for this — it's a
best-effort quality layer, not a correctness gate.

**CALIBRATION-PENDING** (see `plan.md` same-day entry + `backlog.md` section
B): mask ellipse size/feather, color-match strength, alignment plausibility
thresholds, and BlazeFace input normalisation all need on-device tuning
against real photos before this can be considered visually finished. Large
head-angle mismatches between the source photo and the generated pose will
currently fall back to the raw generated image rather than attempt a warped
paste.
  only.

## Generation result — edit-in-place, no more studio backdrop (2026-08-07)

Reverses the two "studio backdrop + editorial framing" changes documented
above. The server-side prompt (`tryon-generate`'s `buildGenPrompt`) no longer
asks the model to regenerate the whole photo — it now edits the uploaded
photo in place, changing only the clothing. Visible effect on the **Result**
screen (`photoZone` in `app/try-on/wear.tsx`, unchanged markup):

- The rendered image keeps the user's OWN background and surroundings —
  no more studio backdrop swap.
- The person's pose, body position, and the camera's framing/crop/angle are
  the same as the uploaded photo — no more full-length head-to-toe
  recomposition or leg-elongation.
- Lighting/shadows on the new garments follow the photo's existing light,
  not a synthesised studio light.

This was the direct fix for faces reading as a different person: asking the
model to both preserve the face exactly AND rebuild the rest of the image
from scratch was self-contradicting, and the face lost every time. No new
screens/states, no client change beyond the intro copy (`wearOnYou_intro`,
now describing "we keep it exactly as it is" instead of promising a
measurement-driven fit render). The trade-off: renders no longer get the
flattering studio/editorial look — see `backlog.md` for offering that as a
future opt-in.

## Face compositing — wider mask, higher working resolution (2026-08-07)

Companion change to the edit-in-place prompt above, in
`src/features/try-on/faceComposite.ts` / `faceCompositeMath.ts`. Still
invisible plumbing (no new screens/states) — same section as "Face
compositing (identity guarantee)" further up, superseding its calibration
notes:

- The inner-face mask now reaches toward the jawline/hairline/ears (via the
  new `faceMaskRadii()`, ear-span aware) instead of stopping at
  eyes/nose/mouth/cheeks — those excluded features are exactly what make a
  face read as a specific person. This was previously too risky because the
  generated face could sit at a different angle than the source; edit-in-
  place makes the generated face nearly the same photo, so a wider paste is
  now safe.
- The working resolution both images are decoded at rose 1024 → 1600px, so
  the (now larger) pasted face region keeps enough detail.
- The feather ramp widened slightly (0.25 → 0.30) for a softer seam over the
  larger mask.
- `__DEV__`-only builds now show a small caption on the Result screen with
  the current run's fallback reason and the cumulative on-device tally by
  reason (see `plan.md`) — a debugging aid, not user-facing copy, so it has
  no i18n keys.
- Still **CALIBRATION-PENDING**: the new mask constants (0.62 ear-span
  factor, 1.4x/2.6x clamp, 1.9x fallback, 1.28 aspect) and BlazeFace's input
  normalisation have not been tuned on a real device — see `backlog.md`.

## Scan screen — scrollable to keep actions reachable (2026-07-23)

`ScanScreen`'s root is now a `ScrollView` (was a non-scrolling `View`). On
short devices, or whenever the profile-completeness note renders (adds
~200px above the frame), the fixed `4/5`-aspect frame guide plus the header
could push the **Take photo** / **Choose from library** buttons and the hint
text below the fold with no way to reach them. The frame guide keeps its
original `aspectRatio: 4 / 5` proportions unchanged; the screen now simply
scrolls when the column's content is taller than the viewport, so the two
primary actions are always reachable. The close (`X`) button remains the
first item in the scroll content — no fixed header was introduced. The
`isScanning` spinner state keeps its centered look via a `minHeight` instead
of `flex: 1` (which doesn't center the same way inside scroll content).

## Wear-on-you — full-body photo required (2026-08-08)

Product requirement, layered on top of the edit-in-place rewrite above: the
result MUST show the user's full body at their real size/proportions. Since
edit-in-place preserves whatever framing the source photo already has, the
only way to guarantee a full-body, truthful result is to require a full-body
INPUT photo — the model is never asked to invent unseen legs/feet (that would
both fabricate proportions and force a re-render that loses the face, per the
edit-in-place rationale above).

- **`tryon-validate` gate is stricter**: the verdict now includes a
  `full_body_visible` field (person visible head-to-toe — legs, feet/shoes,
  not cropped at waist/thigh/knee), checked separately from `body_visible`
  (torso visible enough to place clothing on). Both must be true for `valid`.
  A photo that shows only the upper body now hard-rejects at this cheap
  (no-credit) gate rather than reaching generation. No new client states —
  this surfaces through the existing `invalid` phase / reason notice on
  `app/try-on/wear.tsx`, same as any other rejection reason.
- **Generation prompt gained a body-truthfulness rule**: `buildGenPrompt`'s
  "Strict requirements" now has a second absolute rule (right after face
  identity) forbidding any slimming, lengthening, broadening, or posture
  change to the body — the figure's outline and proportions must stay pixel-
  faithful to the source photo, and the same extent of body visible in the
  source (e.g. feet in frame) must remain visible in the result.
- **Verify pass now compares against the original**: `verifyGeneratedImage`
  sends both the original person photo and the generated result, and the
  verdict schema gained `identity_ok` (same individual) and `body_ok` (same
  body size/shape/proportions/posture/framing) alongside the existing
  `person_ok`/`garments_ok`/`anatomy_ok`. Same fail-open contract as before —
  a false verdict only costs a refund + free retry, never a hard block.
- **Copy**: `wearOnYou_intro` and `wearOnYou_photoHint` now state the
  full-body requirement plainly (head to toe, feet included) with short
  practical framing advice (stand back / prop the phone up), rather than
  presenting full-body framing as merely "more accurate."

## Quota note on the action buttons (2026-08-08)

One line of `type.caption` at 11px in `tertiary`, centered, directly above the
primary action in two phases:

- **`ready`** — above "WEAR ON" (the tap that spends the credit).
- **`result` / `error`** — above "REGENERATE", which spends another one.

Copy: `creditQuota_tryOnsLeft` — "Con {{remaining}}/{{limit}} luot thu do trong
thang nay". Shared component `CreditQuotaNote`
(`src/features/monetization/components/CreditQuotaNote.tsx`), fed by
`useCreditQuota('try_on')` inside `useWearOnYou` and exposed as `quota`.

Why it exists: the paywall stopped naming any numbers (see
`src/design/paywall/design.md`, "Value copy 2026-08-08"), so the screen that
spends the allowance is now where the user learns what it is. Premium accounts
have a real monthly cap too, so this is NOT a free-tier-only affordance.

Rules, same as the wardrobe-add upload step:

- Informational only. Plain text, no border, no tap target, no colour shift at
  zero. The `creditBlocked` notice keeps owning the exhausted state.
- Renders nothing when there is no trustworthy reading (loading, demo account,
  or a failed usage query, where `checkCredit` fail-closes to `remaining: 0`
  for the gate's benefit). Never show a fabricated zero.
- Refreshed in `generate()`'s `finally`, so the count is current whether the
  generation succeeded, was blocked up front, or died on a mid-flight 402.

Distinct from the pre-existing `creditsRemaining` state in the same hook, which
is only populated for non-premium accounts at block/completion time and drives
no copy of its own.

## Failure copy — AI service down vs genuine network failure (2026-08-11)

Both failure states (`invalid` after `runValidation`'s catch, `error` after
`generate`'s catch) previously showed a single "check your connection" style
message for every non-verdict failure, regardless of cause. Reported 2026-08-07
(backlog "L. Gemini prepay credits CẠN"): the Google API key ran out of prepay
credits, Gemini returned 429 RESOURCE_EXHAUSTED, tryon-validate turned that
into a 502 — and the user, whose network was completely fine, was told to
check their connection. Misleading in exactly the moment they need an accurate
signal (only anh Khôi can act on "AI service down"; a user can act on "check
your connection" only when that's actually true).

Both `runValidation` and `generate` in `useWearOnYou.ts` now classify the
caught error via `classifyTryOnFailure()` (`src/services/tryOnWearService.ts`)
before picking copy:

- **AI service unavailable** (the function reached the server but Gemini/the
  function itself failed — `tryon-validate`/`tryon-generate` returning
  500/502/503, e.g. missing `GOOGLE_API_KEY`, an upstream Gemini error, or an
  internal exception): `wearOnYou_serviceUnavailable` — "The AI service is
  temporarily unavailable. Please try again later." /
  "Dịch vụ AI đang gián đoạn — thử lại sau." Shared copy across both phases.
- **Genuine network/offline failure** (the request never reached the server —
  `fetch()` itself rejected): validate keeps the pre-existing
  `wearOnYou_validationFailed` copy unchanged; generate gets a new, parallel
  `wearOnYou_generationNetworkFailed` ("Couldn't generate your try-on. Check
  your connection and try again." / "Không tạo được ảnh thử đồ. Kiểm tra kết
  nối và thử lại.").
- **Unclassified** (e.g. a local image-manipulation error, not a
  `functions.invoke` failure at all): both phases fall back to their original,
  unchanged generic copy (`wearOnYou_validationFailed` /
  `wearOnYou_generationFailed`) — no regression for errors outside this split.

This is purely a copy/classification change — the phase machine, retry
affordances (`pickAnother` / `regenerate`), and the `invalid` verdict path
(`v.valid === false`, a real "photo not usable" outcome, never an error) are
untouched.
