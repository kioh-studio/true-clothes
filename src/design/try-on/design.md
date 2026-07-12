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
