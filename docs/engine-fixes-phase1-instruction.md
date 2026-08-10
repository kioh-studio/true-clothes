# Engine fixes Phase 1 — generate-outfits wiring bugs

Date: 2026-08-06. Approved by anh Khôi (backlog.md §K "Bug thật / code chết").
Executor: Sonnet 5. Scope: `supabase/functions/generate-outfits/**` +
`supabase/functions/wardrobe-critic/index.ts` (SELECT only). Do NOT touch
`evaluate-item/**` (a later phase owns it), do NOT edit `backlog.md`/`plan.md`
(the coordinator updates docs), do NOT deploy, do NOT commit.

## Fix 1 — BodyMeasurements snake_case → camelCase mapping (real bug)

`generate-outfits/index.ts:151` assigns the raw DB row from `body_measurements`
(snake_case: `preferred_fit`, `body_shape`, …) straight into the engine's
`BodyMeasurements` type (camelCase). Consequence: `preferredFitDelta` (±0.12,
`engine/scoring.ts:778`) reads `body.preferredFit` → always undefined → always 0
in the feed; audit whether `body_shape` and any other camelCase field the engine
reads is likewise dead.

Do:
1. List every field the engine actually reads off `BodyMeasurements` (grep the
   engine for `body.` / the type definition in `engine/types.ts`).
2. Add an explicit row→engine mapper at the boundary in `index.ts` covering all
   of them (numeric m_* columns may already align — verify, don't assume).
3. Regression tests (deno, colocated with existing engine tests): a profile row
   with `preferred_fit: 'slim'` + a slim item must produce a different fit score
   than with `preferred_fit: null`; same idea for `body_shape` if it was dead.

## Fix 2 — dead style-silhouette cascade

`engine/silhouette.ts:224` reads `ctx.styleProfile.computedAttributes?.silhouette`
but `index.ts:163-165` builds `{ selectedStyles }` only and `applyIntent`
(`engine/ranking.ts:134`) nulls `computedAttributes`. Net: the style level of the
target-silhouette cascade NEVER fires; everything falls to `body_shape`/neutral.

Do:
1. In `index.ts`, after style resolution (including the wardrobe-affinity
   fallback injection at :333-349), compute `computeUserAttributes(selectedStyles)`
   once and set it as `styleProfile.computedAttributes` BEFORE
   `resolveTargetSilhouette` is called (:368).
2. Investigate why `applyIntent` nulls it (read the comment/git blame). If the
   nulling is guarding stale client-sent data, keep the null but pass the
   server-computed attributes separately or re-set after applyIntent — whatever
   preserves both intents. Explain the choice in a short code comment.
3. Test: profile with selectedStyles=['minimalist'], no body_shape, no intent →
   resolved target must come from the style's silhouette attribute, not the
   neutral fallback. Add one for streetwear/oversized too.
4. Verify `wardrobe-critic/analyze.ts` (imports the same engine) still passes its
   tests — it builds its own ctx; if it constructs styleProfile the same broken
   way, apply the same fix there.

## Fix 3 — wire `primary_hex` / `secondary_hex` / `graphics` (paid-for data unused)

`backfill-item-metadata` populates these columns; nothing reads them.
- `generate-outfits/index.ts:137` SELECT and row mapper (:214-233) omit them →
  the measured-hex colour refinement in `engine/enrichment.ts:674-683` is dead.
- `graphics` (jsonb LogoSignal) is ignored; graphics are inferred from the item
  NAME by keyword (`enrichment.ts:435-441`).

Do:
1. Add `primary_hex, secondary_hex, graphics` to the SELECT in
   `generate-outfits/index.ts` and to the row → engine-item mapping so
   `enrichment.ts`'s existing hex-refinement path activates. Same for
   `wardrobe-critic/index.ts:76`'s SELECT (it feeds the same `toFitItem`).
2. In `toFitItem`/graphics derivation: prefer the structured `graphics` jsonb
   when present (read the LogoSignal shape from the migration
   `supabase/migrations/20260620000001_clothing_items_graphics.sql`); fall back
   to the existing name-keyword inference when the column is null. Keep the
   fallback — most rows may still be null.
3. Tests: (a) item row with `primary_hex` set → colorProfile hue/sat/lum comes
   from the hex, not the named colour; (b) item with `graphics` jsonb indicating
   a large print but an innocent name → statementStrength/graphic handling
   reflects the jsonb; (c) null columns → behaviour identical to today
   (regression guard on an existing fixture).

## Out of scope (stay in backlog — do NOT do)

`StyleConfig.neighbors`/`overrides` consumption, `FitItem.warmth` scoring,
`silhouetteAffinity`, occasion/skip events, exploration. If a fix above forces
you near them, leave a TODO comment and report it.

## Verification

- Run the engine's deno test suite (find the invocation — check for a deno task,
  npm script, or how season-color.test.ts is normally run) — all green.
- `npx tsc --noEmit` for the repo — green (client types may reference nothing
  here, but run it anyway).
- Report: per-fix summary, test output tail, any field you found dead beyond
  `preferredFit`, and anything deferred.
