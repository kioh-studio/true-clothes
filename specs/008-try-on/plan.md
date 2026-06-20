# Implementation Plan: Try On — Pre-Purchase Fit Check & Mix-and-Match

**Branch**: `008-try-on` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-try-on/spec.md`

## Summary

Try On lets a user scan a garment they're considering buying, get an honest 0–100 **Verdict** (overall + per-criterion: Color, Style, Fit, Measurement, Fabric, plus a recommendation label), and **Mix & Match** it against their own wardrobe — all before deciding to **Add** it or discard with **No**. The scanned item is transient until Add.

Technical approach: **reuse, don't rebuild.** Extraction reuses the existing AI (`generate-item-image` edge function via `extractItemsWithImages`) and on-device (`extractItemOnDevice`) paths — both already return `ExtractedItemWithImage`. The Verdict is a **new deterministic server-side edge function (`evaluate-item`)** that scores one item against the user's profile by reusing the fit engine's item-level scoring primitives (color/style/fit/season/fabric), keeping all scoring server-side per Constitution V. Mix & Match **extends `generate-outfits`** to accept a transient pinned item (the scanned garment, which is not yet in the DB) and force it into every complete outfit. The client adds a self-contained `src/features/try-on/` flow, a transient `tryOnStore`, and a `tryOnService`, and commits to the wardrobe through the existing `addWardrobeItem` path on Add. UI follows the provided "True Clothes Try On" v2 reference (combined Scan Result screen + Home-style swipe feed).

## Technical Context

**Language/Version**: TypeScript (strict) on React Native via Expo SDK; Deno for Supabase Edge Functions.

**Primary Dependencies**: Expo Router (file-based nav), Zustand v5 (+ AsyncStorage persist), Supabase JS (auth/DB/storage/functions), `expo-image-picker`, `expo-file-system`, existing `expo-item-extract` native module (on-device path), existing fit engine under `supabase/functions/generate-outfits/engine/`.

**Storage**: Transient scan state in-memory (Zustand, NOT persisted). Cut-out image as a local file (`expo-file-system`) until Add; on Add, persisted via `wardrobeService.addItem` (device copy always; Supabase Storage bucket `wardrobe-photos` for premium). No new tables (see Constraints).

**Testing**: Jest unit tests under `src/**/__tests__/` (pattern already in repo, e.g. `src/services/__tests__/`, `src/utils/__tests__/`); Deno tests for the new edge function and the engine scoring it reuses.

**Target Platform**: iOS + Android (Expo). No web target.

**Project Type**: Mobile app + Supabase backend (Edge Functions).

**Performance Goals**: Scan → complete Verdict under 30s for a typical photo (SC-001); outfit/feed rendering at 60 fps (constitution); edge function warm response < 3s (constitution).

**Constraints**:
- **No new DB tables/columns** for MVP. The scanned item is transient; on Add it uses the existing `clothing_items` insert. Provenance (`source`) reuses the existing extraction method value (`'ai'` | `'item'`) to avoid touching a possibly-constrained live column (project has known migration↔live-DB drift — verify before any schema change).
- All scoring server-side (Constitution V). The client never recomputes the Verdict.
- Verdict must degrade gracefully: criteria with missing user data (FR-009a) or missing item attributes (FR-009b) render "Not enough info" and are excluded from the weighted composite.

**Scale/Scope**: Single-item per scan. ~3 new screens, 1 new edge function, 1 extension to an existing edge function, 1 new store, 1 new service, ~1 new shared type module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Luxury Minimalist Design | All Try On screens use `src/design/tokens.ts` (`T.color`, `T.s`, `type`); follow the provided Try On v2 reference; full-bleed item image on white, hairline UI, no inline hex. | PASS |
| II | Thin Screens / Logic Separation | All logic in `tryOnStore` actions + `useTryOn` hook + services. Screens render state and dispatch only. No async in JSX handlers. | PASS |
| III | Service Abstraction Layer | Supabase reached only via services. New `tryOnService` wraps the `evaluate-item` invocation; Mix & Match invocation lives in a `fitEngineStore` action; Add goes through `appStore.addWardrobeItem` → `wardrobeService`. No direct client import. | PASS |
| IV | Type Safety & Domain Integrity | Metric units (cm/kg) throughout; colors as controlled names (not hex); camelCase domain types in `src/types/tryOn.ts`; snake_case stays inside services/edge functions; no `any`. | PASS |
| V | Dual-Persistence / Server-side Engine | Verdict scoring runs in the `evaluate-item` edge function and **imports the same engine scoring module** as `generate-outfits` (single source of truth). No client-side scoring copy is introduced. | PASS |
| VI | Feature Self-Containment | New code lives under `src/features/try-on/`. Reuse is only via shared services (`imageGenerationService`, `extractByItemService`, `wardrobeService`, `usageCreditService`) and shared stores (`appStore`, `fitEngineStore`) — never by importing another feature's components. | PASS |

**Result**: All gates pass. No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-try-on/
├── plan.md              # This file
├── research.md          # Phase 0 — technical decisions
├── data-model.md        # Phase 1 — entities + contracts overview
├── quickstart.md        # Phase 1 — validation scenarios
├── contracts/           # Phase 1 — edge function contracts
│   ├── evaluate-item.md
│   └── generate-outfits-pin.md
└── checklists/
    └── requirements.md   # (from /speckit-specify, all passing)
```

### Source Code (repository root)

```text
app/
└── try-on/                       # NEW Expo Router group for the flow
    ├── _layout.tsx               # Stack: scan → result → mix-match
    ├── index.tsx                 # Scan/capture + analyzing (thin; renders feature screen)
    ├── result.tsx                # Scan Result + Verdict (thin)
    └── mix-match.tsx             # Home-style swipe feed (thin)
# launch entry added to app/(tabs)/menu.tsx ("Try on before you buy")

src/
├── features/try-on/              # NEW self-contained feature
│   ├── components/
│   │   ├── ScanScreen.tsx
│   │   ├── ResultScreen.tsx
│   │   ├── ItemOnWhite.tsx       # cut-out item on white (per reference)
│   │   ├── VerdictPanel.tsx      # overall score + label + 5 DimScore rows + explanations
│   │   ├── DimScore.tsx          # one criterion: score bar OR "Not enough info"
│   │   ├── MixMatchFeed.tsx      # vertical swipe feed
│   │   ├── MatchFeedCard.tsx     # one outfit card (collage + score + rationale)
│   │   └── index.ts
│   ├── useTryOn.ts               # orchestration hook over tryOnStore
│   └── types.ts                  # feature-local view types only
├── stores/
│   └── tryOnStore.ts             # NEW transient store (NOT persisted)
│       # + new action fetchMixMatchOutfits(scannedItem) added to fitEngineStore.ts
├── services/
│   └── tryOnService.ts           # NEW — invokes evaluate-item, maps to Verdict
└── types/
    └── tryOn.ts                  # NEW shared domain types: ScannedItem, Verdict, CriterionScore

supabase/functions/
├── evaluate-item/                # NEW edge function (Deno) — the Verdict
│   ├── index.ts
│   └── scoring.ts                # item-level scoring; imports shared engine primitives
└── generate-outfits/             # MODIFIED — accept optional transient pinned item
    ├── index.ts                  # parse pin_item; inject into itemMap; pin slot
    └── engine/generation.ts      # add pinned candidate generation
    # item-level scoring factored so evaluate-item can reuse it (single source)
```

**Structure Decision**: Mobile + backend. The flow follows the existing `add-item.tsx` precedent (a feature folder under `src/features/` rendered by thin route files), but uses a small nested Expo Router group (`app/try-on/`) because Mix & Match is a distinct full-screen pushed view, matching the v2 reference's separate artboards. Backend work is one new edge function plus a backward-compatible extension to `generate-outfits`.

## Complexity Tracking

> No constitution violations — section intentionally empty.

## Changelog

### 2026-06-20 — Implementation (US1 + US2 + US3)

**Verdict scoring (`evaluate-item`)** — new deterministic Deno edge function.
Item-level scoring primitives were factored into
`generate-outfits/engine/itemScoring.ts` and reused (single source of truth,
Constitution V). Five criteria (color/style/fit/measurement/fabric) each score
0–100; the composite weights Fit + Measurement above the rest and renormalizes
over only the evaluable criteria. A criterion is unavailable when its item
attribute OR the required profile data is missing — it is excluded, never
fabricated (FR-005/FR-009a/FR-009b).

**Mix & Match — `generate-outfits` pin extension (backward-compatible).** The
request now accepts an optional `pin_item` (the transient scanned garment, not in
the DB). When present: a `FitItem` is built via the existing `toFitItem`
enrichment, injected into the `itemMap` under the synthetic id, and a new
`generatePinnedCandidates()` fixes the pin's slot so **every** returned outfit
includes it and is complete (top+bottom+footwear). All scoring/ranking/filtering
is reused unchanged; absent `pin_item` ⇒ identical baseline behavior; an
uncompletable wardrobe ⇒ `outfits: []` (sparse state). Invalid `pin_item` ⇒ 400.

**Provenance.** On Add, the scanned item is committed through the existing
`appStore.addWardrobeItem` → `wardrobeService.addItem` path. `source` reuses the
extraction method (`'ai' | 'item'`) to avoid touching the possibly-constrained
live `clothing_items.source` column (schema-drift caution); no new tables/columns.

**Transient lifecycle.** `tryOnStore` is not persisted. The cut-out image is a
temp file deleted on discard (`reset()`) and after a successful Add (the wardrobe
service has made its own durable copy). Nothing is written before the explicit
Add (FR-013/FR-015, SC-004). Mix & Match consumes no credit and never persists.
