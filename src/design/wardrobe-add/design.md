# Wardrobe Add Wizard — Design Spec

Feature: 006-ai-item-extraction  
Route: `/add-item` → `AddWizard`

---

## Overview

Full-screen 4-step wizard for adding clothing items to the wardrobe. Triggered from:
- The wardrobe FAB (`+` button in `/(tabs)/wardrobe`)
- The onboarding intro "ADD FIRST ITEM" CTA (`/(onboarding)/wardrobe-intro`)
- Any navigate-to `/add-item` call

All state and async logic lives in `useAddWizard()`. Components are pure views.

---

## Steps

### 1 · Upload

- Large serif headline: "Your photos."
- Vertical list of added photo rows: `96 × 120` thumbnail + method badge (BY AI in `accent` fill / BY ITEM in hairline border) + per-photo `TextInput` multiline note
- Each row bordered at `0.5px hairlineStrong`; photo number badge `rgba(26,24,21,0.62)` top-left
- Dashed "ADD A / ANOTHER PHOTO" button (opens `MethodChooser`)
- Upgrade notice (amber `warning` border) when AI credits exhausted
- Sticky bottom bar: `PrimaryButton` "ANALYSE N PHOTOS" with `IconSparkle` — disabled when 0 photos or upgrade=true

### 2 · Analyse (Processing)

- Full-width `4:5` photo preview with `rgba(26,24,21,0.18)` overlay
- Slow scan line: `Animated.Value`, `Easing.inOut(Easing.sin)`, 2.2s cycle, no bounce — hairline `rgba(250,247,242,0.9)` horizontal bar sweeping top → bottom → top
- Thumbnail strip (visible when >1 photo): completed photos show `rgba(26,24,21,0.5)` overlay + `IconCheck`; active photo shows `1.5px primary` border
- "PHOTO i OF n · BY AI / ON-DEVICE" UI label + serif h2 headline "Finding every piece..."
- Two skeleton rows: `Animated.loop` pulse `0.35 → 1 → 0.35` at 900ms, `0.5px hairline` border

### 3 · Review

- Serif headline: "Review N items."
- Items grouped by source photo: each group has a `40 × 50` source thumbnail header + "PHOTO 01" label + item count + method badge
- `ItemCard` per item:
  - `92 × 116` item image (or placeholder text) with index badge
  - Editable serif name `TextInput` (fontSize 18)
  - `FieldRow` for CATEGORY / COLOUR / FABRIC / FIT / PATTERN / SEASON — `mode="picker"` opens inline chip grid
  - COLOUR picker shows swatch dot `11 × 11` from `swatchFor()` (COLOR_SWATCH hex values — vocab data, not styling hex)
  - BRAND / LINK as `mode="text"` right-aligned `TextInput`
  - Measurements grid (2-col): type-aware via `measureGroupForType()` + `MEASURE_FIELDS`; each field `MeasureField` (decimal-pad, blur → parse to number). Directly below the grid (shown only when the garment type has measurable fields) sits the inline **`MeasurementAIMap`** field (feature 009): an `AI MAPPING MEASUREMENT` text box where the user pastes one size's raw shop measurements (any naming/language/unit). On `MAP WITH AI`, Gemini maps them onto canonical `m_*` keys and auto-fills the grid above; a short summary lists what was filled (with conversion notes like ×2 from flat / in→cm) and any unmapped leftovers. Filled values merge into the measurements object via `onEdit({ measurements: {...} })`; the user can still tweak any field by hand. Reused by `item-edit.tsx` since it renders the same `ItemCard`.
  - Tags: `TagEditor` — filled `primary` chips with `×`, dashed "Add tag…" input
- "REMOVE" in `error` colour top-right of each card
- Empty state when all items removed: dashed border, serif "Nothing to save."
- Sticky bottom: "CONFIRM ALL · N" (disabled at 0 or during saving)

### 4 · Done

- Centered layout: `72 × 72` `primary` circle with `IconCheck`
- `micro` label "ADDED TO WARDROBE"
- `hero` serif count "{N} pieces" (fontSize 56)
- `bodyL` summary text
- `PrimaryButton` "VIEW MY WARDROBE" → `onDone` (navigates to wardrobe tab)
- `SecondaryButton` "DONE" → `onClose` (back)

---

## MethodChooser

Modal bottom-sheet, two phases:

**Phase 1 — Method**
- "Extract by AI" card: `accent` background (`#2C2A26`), `IconSparkle`, hairline "AI" badge, serif 18 title, caption desc, "Best for full looks" meta footer
- "Extract by item" card: `hairlineStrong` border, `opacity: 0.55`, "Coming soon" meta — `isExtractByItemAvailable = false` in service stub

**Phase 2 — Source**
- "Take a photo" → `launchCameraAsync`
- "Choose from library" → `launchImageLibraryAsync({ allowsMultipleSelection: true })`; each picked asset calls `addPhoto(uri, method)`

Dismissable (backdrop tap closes) only when ≥1 photo already added. Non-dismissable on first open.

---

## Stepper

4 nodes connected by `0.5px` hairlines:  
Upload · Analyse · Review · Done

- Active/done nodes: `26 × 26` circle, `primary` fill
- Done: `IconCheck` (white, strokeWidth 1.8)
- Active: number in `canvas`
- Pending: number in `tertiary`, `0.5px hairlineStrong` border
- Connector line: `primary` for completed segments, `hairlineStrong` for pending

---

## Token usage

| Token | Usage |
|---|---|
| `T.color.canvas` | Screen background, sheet background |
| `T.color.elevated` | Photo placeholder, measure input background, skeleton bones |
| `T.color.accent` | "Extract by AI" card background, AI method badge fill |
| `T.color.primary` | Filled circles, confirm button, tag chips, item name text |
| `T.color.hairline` | Inner dividers (0.5px), field borders |
| `T.color.hairlineStrong` | Card borders, dashed button border, badge border |
| `T.color.tertiary` | Labels, captions, step numbers, hint text |
| `T.color.error` | "REMOVE" label, error banners |
| `T.color.warning` | Upgrade notice border/text |
| `T.color.sheetDim` | Modal overlay dim `rgba(26,24,21,0.45)` |
| `T.font.serif` | Item name, group headlines, method card titles, done hero |
| `T.font.sans` | Body, captions, field values |
| `T.font.sansMedium` | UI labels (via `type.ui`) |
| `type.ui` | All uppercase tracking labels (0.5–11px) |
| `type.h1` | "Your photos." / "Review N items." |
| `type.h2` | Processing headline |
| `type.hero` | Done count |
| `type.caption` | Descriptive text below headlines |
| `T.s(n)` | Not used inline; spacing via `StyleSheet` integer values |

Swatch hex values (`COLOR_SWATCH`) are read from `vocab.ts` via `swatchFor()` — they are vocabulary data, not styling constants. All visual colour references use tokens.

---

## Animation rules

- Scan line: `Easing.inOut(Easing.sin)`, 2200ms, loop. No bounce.
- Skeleton pulse: `Easing.inOut(Easing.ease)`, 900ms. Opacity 0.35 → 1 → 0.35.
- No spring animations anywhere in this feature.
- Modal sheet uses native `animationType="slide"` (OS default, non-bouncy on iOS).
