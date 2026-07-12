# Measurements — Body Shape (design notes)

## Body shape selector (2026-07-06)

Both measurement forms (`app/(onboarding)/measurements.tsx` and `app/measurements-edit.tsx`)
expose body shape as **auto-derived but user-editable**:

- Default state is **AUTO**: shape derives live from chest/waist/hips via
  `computeBodyShape()` — covers both hand-typed numbers and AI-scan pre-fill.
- A single wrap row of hairline `Tag`s: `AUTO · <derived>` + the 5 shapes
  (HOURGLASS / RECTANGLE / TRIANGLE / INVERTED TRIANGLE / APPLE). Tapping a shape
  sets a manual override; tapping AUTO reverts to derived.
- Applying a fresh AI-scan estimate always resets to AUTO so a stale manual pick
  never shadows new numbers.
- A saved shape is treated as an override on load ONLY if it differs from what the
  saved measurements derive; otherwise it loads as AUTO.

Copy rule (per body-shape research, docs/research/body-shape-importance-FINAL.md):
avoid corrective language ("hide", "flatter problem areas", "che khuyết điểm") in any
shape-related copy — use neutral line/proportion phrasing.

## Body shape nudge line (2026-07-12)

A single caption-style, tertiary-color line renders below the shape Tag row on both
forms, UI-only (no scoring/logic change), reflecting three states:

- **Missing girths, no override** (fewer than 3 of chest/waist/hip filled, AUTO) →
  `measurements_shapeNudgeMissing` prompts the user to complete all three.
- **Auto-derived, no override** (all 3 girths present, shape derived, AUTO) →
  `measurements_shapeNudgeConfirm` invites the user to tap a shape Tag if it's wrong.
- **Manually overridden** → no nudge; the user already made an explicit choice.
