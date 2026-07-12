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
