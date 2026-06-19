# Implementation Plan: Wardrobe Add-Item Screens

**Branch**: `005-wardrobe-add-item-screens` | **Date**: 2026-06-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-wardrobe-add-item-screens/spec.md`

## Summary

Replace `app/add-item.tsx` (single-screen, no method selection) with a cohesive multi-step
add-item system: a method-selection bottom sheet offering "Extract by item" (on-device,
free) and "Extract by AI" (premium multi-photo wizard), accessible from the wardrobe tab
and the Wardrobe Intro onboarding screen. The Wardrobe Intro navigation is adjusted so it
fires after the colour-palette step and leads to the home feed on completion.

Two new Supabase columns (`measurements JSONB`, `link text`) are added to `clothing_items`
via migration. The AI wizard processes photos through a new Supabase Edge Function with
client-side per-photo status tracking to prevent re-submitting already-analysed photos (AI
cost constraint). All wizard logic lives in `src/features/wardrobe-add/`.

---

## Technical Context

| Key | Value |
|-----|-------|
| Language | TypeScript strict mode |
| UI | React Native + Expo SDK (iOS 15+ / Android 12+) |
| Navigation | Expo Router — file-based stack + tab navigators |
| State | Zustand v5 with AsyncStorage persist middleware |
| Local persistence | AsyncStorage (store state); on-device photo files via `expo-file-system` |
| Remote persistence | Supabase PostgreSQL + Supabase Storage |
| Edge Functions | Deno runtime (`supabase/functions/`) |
| Image handling | `expo-image-picker` (camera + library, multi-select for AI wizard) |
| Testing | Jest + React Native Testing Library |
| Performance goals | Single-item add ≤ 90 s end-to-end; AI wizard for 3–5 photos ≤ 3 min; Edge Function ≤ 3 s warm |
| Constraints | Offline photo capture (local write first); no duplicate AI calls (per-photo cache); no `any` |

---

## Constitution Check

### Gate 1 — New screens/components → Design token compliance (Principle I)

**Status**: APPLIES — COMPLIANT DESIGN REQUIRED.

New components introduced:

- `src/features/wardrobe-add/components/MethodSheet.tsx`
- `src/features/wardrobe-add/components/ItemGuide.tsx`
- `src/features/wardrobe-add/components/ItemProcessing.tsx`
- `src/features/wardrobe-add/components/ItemReview.tsx`
- `src/features/wardrobe-add/components/AIWizard.tsx` + sub-steps

All MUST use `T.color.*`, `T.font.*`, `T.s()` spacing. Hairline stroke icons only. No inline
hex values. Transitions must be slow and deliberate (no spring/bounce). Full-bleed photo
display in processing and review steps.

### Gate 2 — Business logic → Hooks/stores, not JSX (Principle II)

**Status**: APPLIES — HOOKS DEFINED.

Two feature hooks own all logic:

- `src/features/wardrobe-add/useAddItemFlow.ts` — state machine for the single-item path
  (steps: `method | guide | capture | processing | review`); handles camera permission
  fallback, image optimisation delegation, and save dispatch to `appStore`.
- `src/features/wardrobe-add/useAIWizard.ts` — state machine for the AI wizard
  (steps: `upload | analyse | review | done`); owns per-photo `Map<photoId, AnalysisStatus>`,
  retry logic (only submits unresolved photos), premium gate check before analysis.

Screen files render state and call hook actions only. No `async/await` inside JSX.

### Gate 3 — Supabase access → Service modules only (Principle III)

**Status**: APPLIES — SERVICE MODULES DEFINED.

- `src/services/wardrobeService.ts` — extended with `measurements` and `link` in
  `AddItemInput`, `UpdateItemInput`, `ClothingItemRow`. camelCase ↔ snake_case conversion
  remains exclusively here.
- `src/services/aiAnalysisService.ts` (new) — sole caller of the `analyse-outfit-photos`
  Edge Function; manages per-photo result cache (`Map<photoId, ExtractedItem[] | null>`).
  The Supabase client is never imported from components, hooks, or screens.

### Gate 4 — New entity fields → Types in `src/types/`, metric units, named colors (Principle IV)

**Status**: APPLIES — TYPE CHANGES DEFINED.

- `WardrobeItem` in `src/types/fitEngine.ts` gains:
  - `measurements?: Record<string, string>` — values include unit suffix (e.g. `"54 cm"`).
    Metric only; imperial conversion is a UI display concern.
  - `link?: string` — optional product URL.
- Colors remain named strings throughout (`"Cream"`, `"Navy"`, etc.).
- No `any`; where types are dynamic, `unknown` + type guard is used.

### Gate 5 — Scoring/ranking changes (Principle V)

**Status**: N/A — fit engine is not touched.

### Gate 6 — Cross-domain communication → Stores, not direct feature imports (Principle VI)

**Status**: APPLIES — COMPLIANT.

The feature spans wardrobe and onboarding domains:

- `app/(onboarding)/wardrobe-intro.tsx` renders `MethodSheet` (a presentational component
  from `src/features/wardrobe-add/`). Screen files in `app/` are permitted to import from
  feature modules — this is not feature-to-feature coupling.
- After a successful add from the Wardrobe Intro screen, the screen calls
  `useAuthStore().completeOnboarding()` and `router.replace('/(tabs)')`. Cross-domain
  data (wardrobe item saved) flows through `useAppStore().addWardrobeItem()`, not a direct
  import from another feature.

---

## Project Structure

### Documentation (this feature)

```text
specs/005-wardrobe-add-item-screens/
├── plan.md              # This file
├── research.md          # Phase 0 decisions and rationale
├── data-model.md        # Entity definitions and field specifications
├── quickstart.md        # End-to-end validation guide
├── contracts/
│   └── analyse-outfit-photos.md   # Edge Function interface contract
└── tasks.md             # Task list (generated by /speckit-tasks — not yet created)
```

### Source Code

```text
# ── Existing files DELETED ────────────────────────────────────────────────────
app/add-item.tsx                          # replaced entirely by MethodSheet flow

# ── Existing files MODIFIED ───────────────────────────────────────────────────
app/_layout.tsx
  └─ remove Stack.Screen name="add-item"

app/(onboarding)/colors.tsx
  └─ handleContinue: push to /(onboarding)/wardrobe-intro (not /complete)

app/(onboarding)/wardrobe-intro.tsx
  └─ "ADD FIRST ITEM": show MethodSheet overlay instead of navigating to wardrobe
  └─ on successful add: completeOnboarding() → replace('/(tabs)')
  └─ "Skip for now": unchanged (completeOnboarding() → replace('/(tabs)'))

app/(tabs)/wardrobe.tsx
  └─ remove inline AddItemSheet component (dead code replaced by feature)
  └─ FAB: open MethodSheet (state hook) instead of router.push('/add-item')
  └─ "+" nav icon: already opens addOpen state → wire to MethodSheet hook

app/collections/[id].tsx
  └─ remove TextLink that navigates to /add-item; replace with navigation to wardrobe tab

src/types/fitEngine.ts
  └─ WardrobeItem: add measurements?: Record<string, string>; link?: string

src/services/wardrobeService.ts
  └─ ClothingItemRow: add measurements: Record<string, string> | null; link: string | null
  └─ AddItemInput: add measurements?: Record<string, string>; link?: string
  └─ UpdateItemInput: add measurements?: Record<string, string>; link?: string
  └─ rowToItem(): map measurements and link fields
  └─ addItem(): include measurements and link in INSERT
  └─ updateItem(): include measurements and link in UPDATE patch

# ── New files ─────────────────────────────────────────────────────────────────
src/features/wardrobe-add/
├── index.ts                              # barrel: exports MethodSheet, useAddItemFlow, useAIWizard
├── types.ts                             # AddItemMethod, PhotoEntry, ExtractedItem, PhotoAnalysisStatus
├── useAddItemFlow.ts                     # single-item flow state machine
├── useAIWizard.ts                        # AI wizard state machine + per-photo cache
├── components/
│   ├── MethodSheet.tsx                   # bottom sheet: Extract by item / Extract by AI
│   ├── ItemGuide.tsx                     # photo tips with do/don't grid
│   ├── ItemProcessing.tsx                # animated progress (on-device analysis)
│   ├── ItemReview.tsx                    # editable attribute form
│   ├── AIWizard.tsx                      # full-screen wizard shell + step router
│   ├── AIUploadStep.tsx                  # photo list, method badges, per-photo notes
│   ├── PhotoChooser.tsx                  # two-phase overlay: method picker → library multi-select
│   ├── AIAnalyseStep.tsx                 # per-photo scan thumbnails + RETRY FAILED
│   ├── AIReviewStep.tsx                  # extracted items grouped by source photo
│   └── AIDoneStep.tsx                    # count summary + VIEW MY WARDROBE
└── __tests__/
    ├── useAddItemFlow.test.ts
    └── useAIWizard.test.ts

src/services/aiAnalysisService.ts         # Edge Function wrapper + per-photo result cache

supabase/functions/analyse-outfit-photos/
└── index.ts                             # MVP: returns simulated extraction; v2: real vision API

supabase/migrations/20260617000001_clothing_items_measurements.sql
```

---

## Complexity Tracking

No Constitution violations. No complexity entries required.
