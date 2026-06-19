# Phase 0 Research: Try On

Resolves the technical unknowns implied by the spec, grounded in the existing codebase. Each item: Decision / Rationale / Alternatives considered.

## R1 — How to compute the Verdict (5 criteria, 0–100, weighted composite)

**Decision**: A new deterministic Deno edge function `evaluate-item` scores a single item against the user's profile, reusing the fit engine's item-level scoring primitives. Map the five spec criteria to existing engine signals:

| Criterion | Source signal (reused from `generate-outfits/engine`) |
|---|---|
| Color | item `color` → `colorProfileOf()`; align vs `personalPalette` / `colorSeason` (palette-alignment + undertone logic from `scoreColorHarmony`). |
| Style | item style attributes (derived from type/color) vs `selectedStyles` via `STYLE_CONFIGS` palette/fabric/fit allowances + attribute similarity (from `scoreStyleCoherence`). |
| Fit | item `fit` (slim/regular/…) vs `preferredFit` + body-shape suitability (the body-shape multiplier portion of `scoreOutfitFit`). |
| Measurement | garment numeric measurements (cm) vs `bodyMeasurements` ease thresholds (the per-item ease scoring inside `scoreOutfitFit`). |
| Fabric | item `material` vs the style's allowed fabrics + season suitability (`scoreSeasonMatch` / fabric weight logic). |

Each criterion yields 0–100. **Overall = weighted composite with Fit & Measurement weighted higher** than Color/Style/Fabric (FR-007). Proposed starting weights (tunable, documented in the contract): Fit 0.25, Measurement 0.25, Color 0.20, Style 0.20, Fabric 0.10. When a criterion is excluded (R3), renormalize over the remaining weights.

**Recommendation label** (FR-006a) from the overall score bands (proposed): ≥85 "Great match", 70–84 "Worth it", 50–69 "Maybe", <50 "Skip". Thresholds live in the edge function and are easy to tune.

**Rationale**: Deterministic scoring is fast (< 3s, no LLM cost), reproducible (testable acceptance scenarios), and reuses logic the wardrobe already trusts — keeping the Verdict consistent with how outfits are scored. Keeping it server-side satisfies Constitution V.

**Alternatives considered**: (a) LLM-judged verdict — rejected for cost, latency, non-determinism, and untestability; the deterministic engine already encodes the needed fashion rules. (b) Client-side scoring — rejected (Constitution V: engine is server-side; avoid a divergent client copy).

## R2 — Reusing engine scoring without divergence (Constitution V)

**Decision**: Factor the item-level scoring helpers (per-item fit ease, color profile, style-config lookups, fabric/season) into a module under `generate-outfits/engine/` that BOTH `generate-outfits` and `evaluate-item` import. No scoring logic is copied.

**Rationale**: Constitution V forbids divergent engine copies and requires any scoring change to apply in one place. A shared import is the single source of truth.

**Alternatives considered**: Duplicating the math into `evaluate-item` — rejected (guaranteed drift, explicit constitution violation).

## R3 — Missing data handling (item attribute OR user profile)

**Decision**: A criterion is "evaluable" only if BOTH its required item attribute (FR-005/FR-009b) AND its required user-profile data (FR-009a) are present. Otherwise the edge function returns that criterion as `{ available: false, reason }` with no score; the client renders "Not enough info" + a prompt to complete the relevant profile section, and the criterion is excluded from the composite (weights renormalized over evaluable criteria).

Required inputs per criterion: Color→item color + (`personalPalette` or `colorSeason`); Style→item type + `selectedStyles`; Fit→item `fit` + `preferredFit`/body data; Measurement→item measurements + relevant `bodyMeasurements`; Fabric→item `material` + style context.

**Rationale**: Honors FR-005's "never fabricate", keeps the Verdict honest, and matches the two clarifications recorded in the spec. Symmetric treatment of both gaps avoids special cases.

**Alternatives considered**: Neutral midpoint / best-guess scoring — rejected per spec clarifications.

## R4 — Mix & Match with a transient (not-yet-saved) pinned item

**Decision**: Extend `generate-outfits` with an optional `pin_item` object in the request body carrying the scanned item's attributes (type/category/color/material/fit/measurements/warmth) plus a synthetic id (e.g. `"scanned"`). The function builds a `FitItem` from it, injects it into the candidate `itemMap`, and runs a pinned candidate-generation path that fixes the scanned item in its slot so **every** returned outfit includes it. All existing scoring/ranking/filtering is reused unchanged. The client maps the synthetic id back to the local cut-out image when rendering collages.

**Rationale**: The scanned item is not in the DB (FR-013: nothing saved before Add), so an ID-only pin can't work — the attributes must travel in the request. Reusing `generate-outfits` keeps one outfit engine (Constitution V) and inherits complete-outfit assembly (top+bottom+footwear core), satisfying FR-012a; when the wardrobe can't complete an outfit around the pin, zero candidates → the sparse-wardrobe state (Edge Cases).

**Alternatives considered**: (a) A separate `mix-match` edge function — rejected (duplicates the engine). (b) Temporarily inserting the scanned item into the DB then deleting — rejected (violates FR-013, risks orphan rows on failure). (c) Client-side outfit assembly — rejected (Constitution V).

## R5 — Extraction path & credits

**Decision**: Reuse both extraction paths behind the same seam (`ExtractedItemWithImage`). Prefer the on-device path (`extractItemOnDevice`, free, offline) when `isExtractByItemAvailable`; otherwise use the AI path (`extractItemsWithImages`), which consumes one `ai_extraction` credit (free tier: 2/month) via the existing `checkCredit`/`incrementCredit` gate. The Verdict (`evaluate-item`) is deterministic and consumes **no** credit. Mix & Match reuses `generate-outfits` and consumes no extra credit.

**Rationale**: Matches the established cost model; avoids charging users for the deterministic Verdict; keeps Try On cheap when on-device extraction is available.

**Alternatives considered**: A separate Try-On credit type — rejected (no need; reuse `ai_extraction`).

## R6 — Reconciling the v2 UI reference with the 5-criterion spec

**Decision**: Follow the v2 reference's **layout and interaction** (combined Scan Result screen with item-on-white, extracted attributes, score bars, sticky "Decide · Buy or Pass", and a Home-style vertical swipe Mix & Match feed with collage + match score + rationale + page dots + "Back to result"). Use the **spec's five criteria** (Color, Style, Fit, Measurement, Fabric) as the `DimScore` rows (the mock's "Color · Climate · Style" is superseded by `spec.md`, which `reference.md` defines as the source of truth for criteria). The mock's "why it fits / heads-up" maps directly to the per-criterion plain-language explanations (FR-009). **Cost-per-wear is out of scope** (absent from `reference.md`/spec) — omit for MVP.

**Rationale**: `reference.md` says follow the screens for UI but defines the 5 criteria; the spec is the contract. Layout from the mock, content from the spec.

**Alternatives considered**: Adopt the mock's 3 dims + cost-per-wear verbatim — rejected (contradicts spec FR-007 and the recorded clarifications).

## R7 — Transient state & temp image lifecycle

**Decision**: `tryOnStore` holds the scanned item, verdict, and mix-match results in memory and is **excluded from AsyncStorage persistence** (transient). On **No** / leaving the flow / starting a new scan, `reset()` clears state and deletes the temporary cut-out image file (`expo-file-system`). On **Add**, the image is handed to `wardrobeService.addItem` (which makes its own optimized device/cloud copy), then the temp file is cleaned up. Mix & Match outfit suggestions are never persisted.

**Rationale**: FR-013/FR-004-cleanup and SC-004 (0 premature saves); avoids leaking temp files; the existing save path already owns durable image storage.

**Alternatives considered**: Persisting scan state across app restarts — rejected (transient by design; adds cleanup complexity for no user value).

## R8 — Navigation entry point

**Decision**: Launch Try On from the Menu tab (`app/(tabs)/menu.tsx`) as a new large-typography entry ("Try on before you buy"), opening the `app/try-on/` group. Also reachable from the wardrobe-add `MethodChooser` is **not** added (Try On is a distinct intent: evaluate-before-buy, not bulk-add).

**Rationale**: The Options Menu is the established home for full-screen flows (Build an Outfit, Saved, etc.); keeps Try On discoverable without overloading the add-item wizard.

**Alternatives considered**: A Home-feed FAB or a 4th tab — rejected (tab bar is intentionally minimal/hidden; menu is the convention).

## Open items deferred to implementation/tuning (non-blocking)

- Exact criterion weights and recommendation-label thresholds (start from R1 values; tune against real items).
- Whether to expose a dedicated `source: 'try-on'` provenance — deferred until the live `clothing_items.source` constraint is verified (schema-drift caution); MVP reuses `'ai'`/`'item'`.
