# Measurements AI Scan — Design Spec

**Feature:** AI-assisted body measurement estimation from a single front-facing photo.
**Screen path:** `/measurements-scan` (Expo Router, stack push from measurements-edit and onboarding/measurements).

---

## Visual Language

Follows luxury-minimalism: off-white canvas, near-black typography, hairline borders.
No gradients. No shadows. Single accent: T.color.primary (near-black).

---

## Screen Anatomy

```
┌──────────────────────────────────┐
│                          [×]     │  ← close button, aligns flex-end
│                                  │
│  MEASUREMENTS                    │  ← eyebrow (9 pt, uppercase, tertiary)
│  Estimate with AI                │  ← h1
│  Stand straight, facing...       │  ← caption
│                                  │
│  ┌──────────────────────────┐    │  ← guide frame (9:16 aspect ratio)
│  │╔                      ╗ │    │  ← corner ticks (hairline strength)
│  │                        │    │
│  │      〇               │    │  ← subtle oval silhouette hint
│  │                        │    │
│  │╚                      ╝ │    │
│  │                          │    │
│  │  FULL BODY               │    │  ← guide label (10pt, uppercase, tertiary)
│  │  face camera · snug...    │    │  ← guide sub (11pt, muted)
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │  ← clothing tip (hairline-bordered box,
│  │ Wear snug, fitted...     │    │     12pt primary, centered) — loose layers
│  └──────────────────────────┘    │     are the biggest accuracy killer
│                                  │
│  ┌──────────────────────────┐    │  ← PrimaryButton "TAKE PHOTO"
│  │  📷  TAKE PHOTO          │    │
│  └──────────────────────────┘    │
│                                  │
│  Estimates are ±5–10 cm...       │  ← hint (11pt, muted, centered)
└──────────────────────────────────┘
```

---

## States

| Phase | Visual |
|---|---|
| `idle` | Guide frame + TAKE PHOTO button |
| `processing` | ActivityIndicator (large) + "Estimating measurements…" body text |
| `success` | Body text: "Estimated — review and adjust the pre-filled values." Auto-navigates back after 1.2 s |
| `low_confidence` | Body text explaining failure + secondary "TRY AGAIN" button |
| `height_required` | Body text explaining height is needed + secondary "BACK TO FORM" button |
| `error` | Same copy as low_confidence |

---

## Guide Frame

- Aspect ratio: **9:16** (portrait full-body shot guidance)
- Corner ticks: 18 px × 18 px, 1 pt hairline, `T.color.hairlineStrong`
- Oval silhouette: 30% width, 80% height, positioned top 10%, `T.color.hairline` border, 50% opacity
- Labels inside at bottom: `FULL BODY` (10 pt UI uppercase, tertiary) + subtitle (11 pt caption, muted)

---

## Button

- PrimaryButton with IconCamera + "TAKE PHOTO" label
- No secondary "Choose from Library" option — pose estimation requires a controlled photo, not an arbitrary library image

---

## Error / Info States

Both `low_confidence` and `height_required` show a plain body-text message (type.body, secondary color) centered in the remaining space, with a SecondaryButton below. No error icons or alert boxes — luxury minimalism.

---

## Navigation Flow

```
measurements-edit.tsx  ──push──→  measurements-scan.tsx
     (on focus:                         (on success:
  reads pendingEstimate)            setPendingEstimate → router.back())

onboarding/measurements.tsx  ──push──→  measurements-scan.tsx
     (on focus:                               (same)
  reads pendingEstimate,
  calls setField per field)
```

The store field `fitEngineStore.pendingEstimate` is ephemeral (in-memory only, wiped on sign-out/reset). The parent screen consumes and clears it in a `useEffect` watching `pendingEstimate`.

---

## Accessibility

- Close button: `hitSlop={8}` (minimum 44×44 tappable area via style)
- All text meets minimum contrast on T.color.canvas background
- ActivityIndicator uses `T.color.primary` (sufficient contrast)
- "TRY AGAIN" / "BACK TO FORM" buttons use SecondaryButton (full-width, 56 pt height)

---

## Interaction Notes

- Camera launches via `expo-image-picker` `launchCameraAsync` with `cameraType: back`
- No editing step (allowsEditing: false) — the raw photo is fed directly to the model
- Temp photo is deleted via `FileSystem.deleteAsync` immediately after inference, success or fail
- The screen does NOT show the captured photo to the user

---

_Last updated: 2026-06-27_

## Distance-readable capture feedback (2026-07-06)

Self-scan with the front camera means the user stands 2-3 m away — small text is
unreadable there. The scanning screen therefore communicates state at billboard scale:

- **Frame border** (4 px, full screen): muted green `#5B8A6B` = pose good, muted amber
  `#C2853B` = adjust. Mirrors the skeleton overlay color.
- **Giant numeral** (Cormorant serif, 148 pt, weight 200, white 92%): counts down the
  auto-capture (2…1 while holding a good pose) and the 10 s self-timer. Centered,
  pointer-events none.
- **Hint pill**: bumped to 15 pt.
- **Controls row** (scanning phase): `10S TIMER` + `CAPTURE NOW` outline pills. Timer
  button shows live seconds while running and is disabled.
- Dev builds only: a small white diagnostic line above the controls
  (`kp X/7 · fill Y` or `no pose returned by MoveNet`) for on-device debugging.

## Silhouette pass & A-pose guidance (2026-07-06)

- Instruction copy (intro + live) now asks for a light A-pose: "arms slightly away
  from your body" / "tay dang nhẹ khỏi người" — required so the waist contour row
  doesn't merge with the arms.
- No new visible UI for the segmentation pass: it runs inside the existing
  'processing' veil after capture. Failure is silent (falls back to keypoint
  heuristics) — never surface a segmentation error to the user.

## On-device privacy reassurance (2026-07-06)

Two placements, both via `t()` (en + vi):

- **Permission gate** (before the user grants camera access — the highest-leverage
  spot): full sentence `measurementsScan_privacy` rendered as a second caption line
  below `measurementsScan_permissionMessage`, same `caption` style (tertiary color),
  `marginTop: T.s(4)`.
- **Live-camera intro** (`phase === 'intro' || phase === 'error'`, directly above the
  START button): compact one-liner `measurementsScan_privacyShort`, new `privacyText`
  style — a dimmer/smaller variant of `introText` (11 pt vs 12 pt, white at 70%
  opacity vs 100%), centered, prefixed with "· " in place of an icon glyph (no
  hairline lock/shield icon exists in `src/components/icons` — text-only per design
  intent, no new icon invented).

Same on-device promise appended as a sentence to the existing tertiary caption on the
personal-color camera intro (`app/(onboarding)/personal-color.tsx` and
`app/personal-color-edit.tsx`): "Processed on your device — your photos never leave
this phone." `DrapeSession` already carries its own "Nothing leaves your phone" line
and was left untouched.

## Two-pass capture refinement + tilt gate (2026-07-12)

No new screen or layout change — this is entirely a "same UI, sharper number
underneath" pass, plus one new hint pill.

- **Buffer size 3 → 4.** One more frame in the ring buffer used for
  multi-frame median aggregation (aggregateFrames.ts) — no visible change,
  slightly steadier estimate.
- **Capture photo quality 0.35 → 0.5.** Sharper JPEGs feed the capture-time
  cropped segmentation pass; still well within the 1.2 s poll cadence.
- **New tilt hint pill.** While scanning, if the phone is held off-upright
  (DeviceMotion, ~12° threshold — CALIBRATION-PENDING), the hint pill shows
  "Prop the phone upright — it's tilted" (`measurementsScan_hint_tilt_phone`)
  instead of whatever the pose gate would otherwise show, using the SAME
  amber pill style as every other adjustment hint (`hintAdjust`) — no new
  visual treatment. On a device/platform without a motion sensor this hint
  never fires (no gating), so nothing changes there either.
- **"Stand straight, square to the camera" now also fires when turned
  sideways**, not just when tilted — same copy/pill, no visible difference,
  just a second trigger condition (`poseQuality.ts`'s `assessPose`).
- **Processing veil unchanged.** The two-pass refinement (Thunder keypoint
  re-inference + cropped segmentation, per buffered frame) all happens inside
  the existing 'processing' ActivityIndicator veil — failure per-frame is
  silent (falls back to that frame's first-pass keypoints/no widths), same
  "never surface a model-internals error to the user" policy as the original
  silhouette pass.
- Dev-only diagnostic line gains two more fields (shoulder-span pass-1 vs
  refined, and the mask-extent scale reading) — `__DEV__` only, never visible
  in a production build.

## BlazePose Heavy + MODNet model upgrade (2026-07-12)

Model-only swap under the hood (MoveNet Thunder → BlazePose Heavy for keypoint
refinement, Selfie Segmenter → MODNet for matting, both capture-time only) — no new
screen, layout, or copy change. The only thing a user might notice:

- **Processing may take a little longer at capture.** Both replacement models are
  larger/higher-capacity than what they replace, and — to keep the wait reasonable —
  only the best 3 buffered frames get the expensive refinement pass now (previously
  every buffered frame did). Still surfaces as the same 'processing' ActivityIndicator
  veil as before; no new loading state or progress indicator was added.
- Everything else (hint pills, frame border colors, countdown numeral, privacy copy,
  A-pose guidance) is unchanged.

## Side-view (profile) depth capture — turn interstitial + SKIP (2026-07-12)

The scan now has TWO capture passes: front (unchanged from every prior round above),
then — after a brief full-screen interstitial — a SIDE (profile) pass that measures
front-to-back body depth directly, instead of guessing it from BMI. Depth is the
single biggest accuracy lever left for bust/waist/hip (see plan.md changelog).

### New states

| Phase | Visual |
|---|---|
| `scanning` (subPhase `'front'`) | Identical to the existing scanning screen — camera preview, skeleton overlay, frame border, hint pill, countdown numeral, TIMER/CAPTURE NOW pills. Nothing new here. |
| `turn` | Full-screen dark veil (same `rgba(0,0,0,0.55)` treatment as the processing veil) over the still-live camera preview. Serif title (30 pt, weight 300, same `Cormorant` family as the giant countdown numeral, just body-copy scale) + a dimmer caption line below. Auto-advances into `scanning`/`'side'` after ~2.5 s — no user action required. A SKIP pill (see below) is the only control shown. |
| `scanning` (subPhase `'side'`) | Same frame border / skeleton overlay / hint pill / countdown / TIMER+CAPTURE NOW row as the front pass — the hint pill can now also show the new `turn_side` copy ("Turn sideways to the camera") when the person hasn't actually turned yet. A SKIP pill appears below the TIMER/CAPTURE NOW row. |
| `processing` | Same ActivityIndicator veil as before, now with a small "x/y" progress line underneath (muted, 12 pt) — the two-view pipeline takes noticeably longer than the front-only one did. |

### Turn interstitial copy

- EN: "Turn to your side" / "90° — arms relaxed, hands slightly forward"
- VI: "Xoay người sang ngang" / "90° — tay thả lỏng, bàn tay hơi đưa ra trước"

### SKIP pill

Outline pill, same visual language as the existing TIMER/CAPTURE NOW pills but
smaller (11 pt text, thinner border at 60% white) — a visually QUIETER affordance than
the primary controls, since skipping is the fallback path, not the intended one.
Copy: EN "SKIP — front only" / VI "BỎ QUA — chỉ dùng ảnh thẳng". Tapping it finishes
the scan with front data only — identical to today's pre-side-view estimate (BMI-
guessed depth), no visible difference in the success/error states that follow.

### No new failure UI

The side pass is a bonus signal — any failure in it (no usable frames, no usable
depths, no computable scale) is completely silent: the scan proceeds to the same
'processing' → 'success' flow as a front-only scan always has, exactly like the
existing silhouette/refinement passes' "never surface a model-internals error to the
user" policy. There is no "side scan failed" message anywhere in the UI.
