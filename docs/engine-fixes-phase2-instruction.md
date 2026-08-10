# Engine fixes Phase 2 — evaluate-item scoring quality

Date: 2026-08-06. Approved by anh Khôi (backlog.md §K "Chất lượng chấm điểm").
Executor: Sonnet 5. Runs AFTER Phase 1 (generate-outfits wiring) has landed.
Scope: `supabase/functions/evaluate-item/**`; `supabase/functions/generate-outfits/
engine/scoring.ts` ONLY to export existing sub-functions (no formula changes
there); client verdict copy files. Do NOT edit `backlog.md`/`plan.md`, do NOT
deploy, do NOT commit.

## Fix 1 — single-item colour & fabric scorers (kill the degeneracy)

Today `evaluate-item/scoring.ts` scores one item through outfit-level scorers:
- colour: 5 of 7 sub-terms are constants for a single item (`colorRelationship`
  → 0.9, `undertoneConsistency`/`saturationConsistency`/`colorCount`/
  `graphicDensity` → 1.0, `lightnessContrast` → the 0.5 branch), so the base
  collapses to `0.20·paletteAlignment + 0.705` → a 70–91 band before bonuses.
- fabric: `scoreSeasonMatch` fixes internal consistency at 0.8 → raw clamped to
  [32, 92]. A wool coat in summer floors at 32, never lower.

Do:
1. Add single-item variants **inside `evaluate-item/scoring.ts`** (import the
   needed sub-functions from the engine — export them from `engine/scoring.ts`
   if private; do not alter engine formulas):
   - `scoreSingleItemColor`: drop the constant sub-terms; the base must be
     driven by paletteAlignment and span the full range; keep the existing bonus
     magnitudes (personal-season ±, weather ±0.08, tone12 ±0.08/−0.06) applied
     on top; clamp 0..1. Document the formula in a comment.
   - `scoreSingleItemFabric`: score = weather-season target match directly
     (using the same `SEASON_COMPAT` values) + the existing style allow/ban
     fabric bonus; no fixed 0.8 internal term.
2. Wire the verdict's `color` and `fabric` criteria to the new variants.
3. Tests (extend `evaluate-item`'s existing test file(s)):
   - deep-winter user + black item → colour score high (≥80); same user +
     warm orange item → low (≤45); user with no palette → colour criterion
     behaves sanely (mid, not extreme).
   - wool/winter item evaluated in summer → fabric well below 32's old floor;
     linen in summer → above the old 92 cap.
   - Distribution guard: across the existing fixture items, colour scores must
     no longer all land in [70, 91].

## Fix 2 — provenance gate (stop confident guessing)

`deriveFitWithProvenance` marks defaulted fits (`provenance.fit === false`); the
feed respects that (`ranking.ts:268-288`), the verdict does not — its `fit`
criterion's missing-check is `!item.typeName` (`evaluate-item/scoring.ts:251`),
which can never trigger. An unlabelled HOODIE defaults to `oversized` and a
slim-preferring user gets a confident 10/100.

Do:
1. When the item's fit is provenance-defaulted AND the request supplied no
   explicit `fit`, mark the `fit` criterion `available: false` with the
   existing "not enough info about the item" copy path (it renormalises weights
   already). Same treatment for the measurement criterion is NOT needed (it
   already keys off actual garment measurements).
2. Test: item without `fit` in the request → fit criterion unavailable; item
   with explicit `fit: 'oversized'` → scored as today.

## Fix 3 — bilingual criterion explanations

Contract (`specs/008-try-on/contracts/evaluate-item.md:22`) promises `locale`
drives explanation language; every template in `evaluate-item/scoring.ts:72-148`
is hard-coded English, and `src/features/try-on/wardrobeFit.ts:52-68` labels are
EN-only rendered raw.

Do:
1. Server: make the criterion explanation templates locale-aware (en/vi), keyed
   off the request's `locale` (the `note.ts` EN/VI pattern already exists —
   follow it). Translate all bands + unavailability copy; keep the voice.
2. Client: move `wardrobeFit` labels/explanations to i18n keys in en.json/vi.json
   and render via `t()` (`WardrobeFitRow.tsx:23`).
3. Tests: locale='vi' request → explanations in Vietnamese (assert a known
   string); default/en unchanged.

## Out of scope (leave in backlog)

Confidence-weighted scoring, footwear/accessory measurement criterion,
verdict-vs-feed reconciliation, persisting verdicts, dropped client metadata
fields. TODO-comment if you brush against them.

## Verification

- Engine + evaluate-item deno tests green; `npx tsc --noEmit` green;
  `npx jest src/features/try-on` green (wardrobeFit changes).
- Report per-fix summary, test tails, before/after score examples from fixtures,
  anything deferred.
