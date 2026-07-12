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

### 2026-06-30 — Taste vector from behaviour (lever L2): per-user "gu" nudge

Lever L2 of the stylist-engine roadmap — the last one. `ranking.ts` read ZERO user
history before this; now the feed leans toward the looks the user actually
SAVES/WEARS over time.

**Verify-first finding (per the backlog gate).** The only stored behaviour signals are
in `outfit_interactions` (types `saved`/`worn`/`scheduled`/`impression`). **There is NO
dismiss/skip event → positive-only is the only option** (matches the backlog). Prod
currently has 1016 `impression` rows but **0 `saved`/`worn`** — the demo wardrobes were
seeded, never used — so L2 ships **dormant and self-activating**: it does nothing until a
user saves/wears outfits, then strengthens as history accumulates. `appStore`
toggleSave/toggleWorn already sync to `outfit_interactions` server-side, and the
`outfit_id` IS the slot key (`top|bottom|shoes|outwear|accessory`), so item ids are
recoverable without any extra stored data.

**Design (`engine/taste.ts`, new).** `buildTasteVector(positives, itemMap)` aggregates the
user's saved+worn outfits (worn weighted 2×, saved 1×) into an item-derived vector:
mean formality, mean statement (loud↔quiet lean), mean lightness spread (tonal↔contrast
lean), and a normalized favourite-colour histogram. `tasteAffinityDelta(items, tv)` returns
a **purely positive, capped (≤ +0.06), confidence-scaled** bonus: affinity below a 0.4
floor earns nothing, and the bonus scales by `min(1, sampleCount/8)` so a tiny sample
barely nudges and **zero samples is a true no-op**. It never penalises (absence of a save
is not a negative).

**Integration.** `index.ts` loads saved+worn in the existing parallel `Promise.all`
(RLS-scoped to the caller, best-effort), parses each `outfit_id` → item ids, resolves them
against the FULL wardrobe (not the style-filtered subset, so the signal isn't biased by
today's filter), builds the vector, and sets `ctx.tasteVector`. `ranking.ts` adds
`tasteDelta` alongside the existing gender delta in `totalScore`
(`(base+taste.bonus)*taste.multiplier + genderDelta + tasteDelta`). Applies to the normal
feed and Mix & Match alike (harmless nudge). `types.ts` gains `TasteVector` +
`EngineContext.tasteVector?`.

**Verified:** Deno engine suite **58/58 pass** (+7 taste tests: empty/unresolvable →
undefined, vector reflects liked-outfit character, worn>saved weighting, on-taste >
off-taste, bounded [0,0.06], confidence scaling), `deno check index.ts` clean. **Deployed
`generate-outfits`** (verify_jwt preserved; 401 confirmed). Roadmap L1+L2+L3 now all
landed. Follow-ups: (a) seed a few demo saved/worn so L2 is demonstrable before real usage;
(b) a negative signal (dismiss/skip) would let it learn faster — needs a new event type;
(c) favourited-item-as-hero (L3 extension) can now read the same positive history.

### 2026-06-30 — Hero-first generation (lever L3): fixes + verified + deployed

Lever L3 of the stylist-engine roadmap: generate outfits built AROUND a high-statement
"hero" wardrobe piece (one hero + quiet supports — the 1-2-3 rule) so striking pieces
get featured even when formula scoring would bury them. `scoreAnchorClarity` already
rewards that shape, so no new scoring was needed. The core (`generateHeroCandidates`
+ shared `buildAroundFixed`, `engine/generation.ts`) + `hero.test.ts` already existed
on the branch; this entry covers correctness fixes found by running the suite + the
integration wiring + deploy.

**Bugs found & fixed:**
1. **Integration crowd-out (`index.ts`).** Hero candidates were APPENDED then
   `.slice(0, GENERATION_CAP)` — but a data-rich wardrobe (post-L1 backfill) saturates
   the formula pool at `GENERATION_CAP=500`, so the slice dropped EVERY hero candidate,
   making L3 dormant on exactly the wardrobes it should help. Now PREPENDED so heroes
   (≤ `HERO_CAP`×`HERO_PER_CAP` ≈ 144) are guaranteed a slot and still leave room for
   formula candidates.
2. **Loud-accessory support leak (`generation.ts`).** A statement accessory/jacket was
   pulled into the optional flair slots as "support", fighting the hero. The optional
   accessory + non-hero outerwear pools now exclude statement pieces
   (`>= HERO_MIN_STATEMENT`) so supports stay quiet (core slots unfiltered — the hero
   already anchors). This was a real `hero.test.ts` failure.
3. **Self-contradictory test (`hero.test.ts`).** The HERO_CAP test's exclusion loop
   asserted the HIGHEST-statement heroes were excluded, contradicting its own comment
   and the (correct) descending-sort impl. Fixed to assert the LOWEST four are excluded
   and the top-6 are present.

**Hero-selection rule upgraded (same day, anh Khôi chose all three).** The original
rule picked heroes purely by `statementStrength` (loudest items), top-6. Now hero
selection uses a blended **`heroScore` = statementStrength + structuralPresence +
paletteBonus**, with per-type diversity:
- **Structural presence** (`generation.ts`): a tailored/outerwear piece can LEAD by
  cut, not colour — `outwear +1.0`, `formality≥4 +0.8` (≥3.5 +0.5), deliberate
  silhouette (`slim`/`oversized`) `+0.3`, capped 1.8. Without this a minimalist/all-
  neutral wardrobe (MIEN's target) would never get a hero and L3 would no-op there.
- **Palette affinity** `+0.5` when the piece sits in the user's own colour palette,
  so the featured item also matches their taste (`index.ts` resolves
  `colorPreferences` → primaries and passes them in).
- **Per-type diversity:** at most ONE hero per `typeName` so the feed isn't six near-
  identical statement pieces; then capped at `HERO_CAP`.
- The fallback now also accepts a structural (not just non-neutral) piece. Threshold
  `HERO_MIN_STATEMENT` reused as the heroScore floor. Behaviour for a flat neutral-
  basics wardrobe is unchanged (still []). Tests extended (`fi` fixture gains
  typeName/formality/fit/primaryColor; +3 tests: type diversity, structural hero,
  palette tie-break); the HERO_CAP test now uses distinct types.

**Verified:** full Deno engine suite **51/51 pass** (was 48; +3 hero-rule tests),
`deno check index.ts` clean. **Deployed `generate-outfits`** — WITHOUT `--no-verify-jwt` so
`verify_jwt=true` is preserved (a user-facing function must keep JWT gating; confirmed
401 for no-/anon-only calls post-deploy). Heroes are wired only into the non-pinned
feed path; Mix & Match (`generatePinnedCandidates`) is untouched. Backward-compatible:
a wardrobe with no statement (or no non-neutral) piece yields no hero candidates →
identical to before. Client unchanged — the feed reflects it on next fetch. Roadmap
L2 (per-user taste vector from behaviour) remains.

### 2026-06-30 — Engine data-starvation fix: backfilled item metadata (lever L1)

**Problem.** The outfit engine is sophisticated (8 scoring dims + taste layer +
formula pools + LLM curator) but was STARVED: of 69 live `clothing_items`,
`fit`/`material`/`warmth_season` were ~1/69 and `pattern` ~5/69 (the cloud items
are the seeded demo wardrobes, inserted directly, bypassing the AI extraction that
fills these at ingest). So `enrichment.ts` filled type-derived defaults →
`proportion`/`texture`/`season`/half of `fit`/`statement`/`anchor` were near-CONSTANT
across outfits → score separation collapsed → the quality gate couldn't cut → feed
padded with mediocre. The "beautiful" formulas (`texture_stack` needs ≥3 materials,
`pattern_solid` needs patterns, `contrast_pairing`/`high_low` need fit/fabricWeight)
gated on exactly those NULL columns → never fired → generation fell back to
`one_two_three`/`rule_of_thirds` = bare top+bottom+shoes (the "items lumped" feel).

**Fix — ran `backfill-item-metadata` on prod.** The one-off admin edge fn re-runs the
same `generate-item-image` Gemini vision detector on each item's stored cloud photo
and backfills ONLY currently-NULL `material`/`fit`/`pattern`/`warmth_season`/
`primary_color`/`graphics` (never overwrites). Pre-flight verified FK-safety: only
`material` has an FK (→ `fabric_types`), and all 17 controlled MATERIALS exist there;
the other five columns have no FK. Deployed `--no-verify-jwt` (admin-gated by
`x-admin-secret` == `BACKFILL_ADMIN_SECRET`, fail-closed).

**Two operational fixes during the run:** (1) a single `limit:200` pass hit
`WORKER_RESOURCE_LIMIT` (OOM from accumulating base64 images in one worker) after
~36 items — split into small fresh-worker chunks. (2) `SELECT … LIMIT` had no
`ORDER BY`, so it kept returning the same head rows (shoes/bags whose missing `fit`
the model never fills) and starved the fillable garments behind them — added
`.order('id') + range(offset, …)` (new `offset` body param) so callers page through
the whole set deterministically. Both committed to the fn.

**Result (prod, verified):** material 1→62, fit 1→55, pattern 5→68, warmth_season
1→65, primary_color→68, graphics→68 (of 69). Remaining gaps are inherent: 3 items are
`photo_storage='local'` (device-only, unfetchable server-side) and a few where the
model genuinely couldn't read the fabric, plus shoes/bags/accessories where `fit` is
N/A (the engine's `scoreItemFit` doesn't measure those categories anyway). Both real
wardrobes now carry 8 distinct materials, 4–5 fits, patterns, and 3 seasons (were ~1
each) → the rich formula pools can fire and `proportion`/`texture`/`season` stop being
constant, so `ranking.ts` confidence-weighting keeps them and the quality gate can
actually separate. No client change; the feed reflects it on next fetch. Lever L1 of
the "stylist engine" roadmap (backlog) — L2 (taste vector from behaviour) and L3
(hero-first generation) remain.

### 2026-06-25 — Review round 2c: engine bug-fixes + measurement store sync

**Engine (`generate-outfits/engine`).** `numericSim` now clamps to `[0,1]`
(pattern/texture gaps >4 had produced negative similarities dragging
style-coherence below 0). Removed the `'leg opening' → waist` `LABEL_TO_KEY`
entry that corrupted pant waist ease. Diversification no longer re-sorts after
greedy selection (the post-loop sort had made ranking order-dependent on the
penalty); the greedy pick order is now the final order. `scoreOutfitFit` averages
only items that produced a real measured fit score (`ItemFitResult.measured`),
so one measured item is no longer diluted by 0.5 placeholders. The sparse-metadata
confidence down-weighting (proportion/texture/season on defaulted values) was
left as `// TODO(sparse-confidence)` — it needs a provenance flag through
enrichment that doesn't exist yet, so it wasn't fabricated. Redeployed
`generate-outfits` **and** `evaluate-item` (both bundle the shared engine; the
`scoreItemFit` return gained `measured` additively — `evaluate-item` still reads
`.points/.score/.warnings` unchanged).

**Measurement store sync.** Body measurements live in two stores
(`authStore.measurements`, read post-onboarding by `try-on/wear.tsx`, and
`fitEngineStore.bodyMeasurements`, the canonical edit/engine source). Editing one
left the other stale until hydrate. Each store's measurement write now mirrors
the other in-memory (raw `setState`, no extra DB write, no circular re-entry):
`authStore.saveMeasurements` → `fitEngineStore`, and
`fitEngineStore.setBodyMeasurements` → `authStore` (merged, preserving
authStore-only `bodyShape`/consent fields).

### 2026-06-25 — Review round 2b: edge security hardening + deploy

**SSRF.** `tryon-generate` `fetchImagePart` now allowlists `image_url` to the
project's own Supabase Storage host (`SUPABASE_URL` origin + `/storage/` path,
https only) before any server-side fetch — blocks internal-IP / cloud-metadata
SSRF while still allowing legitimate signed garment URLs. **Webhook.**
`revenuecat-webhook` shared-secret check is now constant-time (compares SHA-256
digests, hiding length + content from timing analysis). **Grants.** Revoked
`EXECUTE` on `consume_usage_credit` / `refund_usage_credit` / `consume_rate_limit`
from `anon` (Supabase default privileges had granted it; the functions are
auth.uid()-scoped no-ops for anon anyway, but least-privilege + clears the
advisor). `rate_limits` intentionally has RLS enabled with no policies (only the
SECURITY DEFINER function touches it).

**Deployed** all five affected edge functions to production
(trtjcsxcowqecsebvyme): generate-item-image, tryon-generate, map-measurements,
describe-outfit (verify_jwt on), and revenuecat-webhook (`--no-verify-jwt`,
confirmed `verify_jwt=false`). Migrations `20260625000002` (consume + rate +
refund) and `20260625000003` (anon revoke) applied.

### 2026-06-25 — Review round 2: privacy, paywall, feed/schedule durability

**Privacy (sign-out data leak).** On sign-out the app retained the previous
user's private body measurements / style / colour prefs (`fitEngineStore`) and
server state (`appStore`) in memory. Added `fitEngineStore.reset()` +
`appStore.resetUserState()`, invoked from `authStore.logout`, `deleteAccount`,
and the signed-out branch of `onAuthStateChange`.

**Auth.** `isLoggedIn` is now set from session presence in `hydrateProfile`
(was gated on the profile row loading, so a transient fetch error bounced valid
users to onboarding). OTP VERIFY guarded against double-submit. Onboarding steps
(basics/location/measurements) now check the write `{ ok }` result and block
navigation + surface an error instead of silently dropping data. Body
measurements are range-validated (height 50–250, weight 20–300, girths 30–200)
before save in both onboarding and edit. `getCurrentUserId` uses `getUser()`.

**Monetization.** Built the missing `app/paywall.tsx` (renders RevenueCat
offerings, wires `purchase`/`restore`, graceful fallback when RevenueCat is
absent) and routed the previously-dead "upgrade" banners to it. After a
successful purchase the auth store re-hydrates so the server `account_type`
gate refreshes without waiting for the webhook. Wired `removeItemFromCollection`
(long-press) and removed the wrong-collection `|| collections[0]` fallback.

**Feed / schedule durability.** Generated outfit ids now include the full slot
set (mirrors `fitEngineStore.outfitKey`) so distinct outfits no longer collide
on React keys / save toggles. Scheduled outfits persist a durable
`OutfitSnapshot` (`appStore.scheduledOutfits`) rendered independently of the
volatile regenerated feed, so plans survive a reload. Settings unit toggle now
persists via `setUnitPreference`. Feed pagination threshold corrected (3 → 0.5)
and gated to the real generated feed; FlatList perf props + `React.memo` +
momentum-based active tracking added; dead bell/bookmark controls removed, share
wired; outfit-detail `JSON.parse` guarded and the half-built variation sheet +
debug logging removed.

**Credit gate regression (from round 1) fixed.** The gate consumed a credit
before input validation and never refunded on Gemini failure; moved after
validation + added `refund_usage_credit` so only delivered results are charged
(see the entry below).

### 2026-06-25 — Review hardening: server-authoritative credits, gate, engine fixes

**Server-side credit/rate gate (security + cost).** The client-side
`incrementCredit()` was non-atomic and never incremented past 1 (the upsert
overwrote `credits_used=1` without erroring, and the RPC fallback it referenced
did not exist) — free limits were unenforceable and the Gemini edge functions
could be driven without bound from one free account. Credit consumption is now
**server-authoritative**: migration `20260625000002` adds atomic
`consume_usage_credit(p_type, p_period, p_limit)` (auth.uid()-scoped,
check-and-increment in one statement) and a generic `consume_rate_limit`
(+`rate_limits` table). `generate-item-image` (ai_extraction, 2/mo) and
`tryon-generate` (try_on, 2/mo) now gate before Gemini — premium/demo bypass,
others get HTTP 402 `{error:'credit_exhausted'}` when exhausted; the
account-type read is RLS-scoped (`profiles: select own row`). The gate runs
**after** input validation (a malformed 400 never consumes) and the consumed
credit is **refunded** (`refund_usage_credit`, floored at 0) when the Gemini
call fails or returns nothing — so a free user is only ever charged for a result
they actually received, matching the old `results.length > 0` semantics. The cheap text
functions `map-measurements` (30/min) and `describe-outfit` (60/min) are
rate-limited → HTTP 429. Client removes the broken `incrementCredit`, keeps
`checkCredit` for pre-flight UX, and maps the server 402 to `needsUpgrade` /
`creditBlocked`. Known follow-up: `useAddWizard.analyse()` swallows a per-photo
402 (TODO marker left) — non-crashing, pre-flight check still gates the UI.

**Engine scoring corrections (`generate-outfits/engine/scoring.ts`).** (1)
`bodyShapeMultiplier` was a `[0.85,1.15]` multiplier clamped by `Math.min(1.0,…)`,
which collapsed every well-fitting outfit to exactly 1.0 and erased fit
separation; it is now a centered additive delta in `[-0.10,+0.10]`
(`scoreOutfitFit = clamp01(base + delta)`), symmetric (penalizes poor shape
matches). (2) `easeScore` applied one curve to girth (tight = unwearable) and
length (short = suboptimal) alike; girth keys now use a steep quadratic to ~0 at
body-size, lengths keep the gentle curve, and every return is clamped `[0,1]`.
(3) `autumn`/`fall` key mismatch could silently zero the personal-color bias —
normalized at the lookup site plus a `fall` alias.

**State layer.** `appStore.hydrate()` now binds the NetInfo + auth listeners
once (module guard) instead of leaking a new pair per hydrate/Fast-Refresh;
`authStore` guarded likewise. `loadServerState` skips overwriting the
interaction sets while an optimistic save/schedule/worn write is in flight
(in-flight counter) so toggles aren't clobbered by an auth-edge refetch.

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

### 2026-06-21 — Deployment + standalone-item extraction fix

**Root cause of the three runtime failures was deployment drift, not app code.**
The live project (`trtjcsxcowqecsebvyme`) was missing the feature's backend:
- `evaluate-item` had **never been deployed** → every Verdict call returned `404`
  (non-2xx) and the Result screen showed an error. **Fix: deployed `evaluate-item`
  (v1).**
- `generate-outfits` on live was **v10 (2026-06-15)**, predating the `pin_item`
  extension → Mix & Match requests were served by the old code, which ignores the
  pin and returns ordinary outfits (none guaranteed to contain the scanned item),
  so the feature appeared not to work. **Fix: redeployed `generate-outfits` (v11)
  with the pin generator.**

**AI extraction prompt — standalone items.** `generate-item-image` is shared with
the wardrobe AI-add flow and its isolation/detection prompts assumed the input was
"a person wearing an outfit." A Try On scan is a **single garment on its own**
(hanger/mannequin/flat-lay), so the person-framed isolation prompt could yield an
empty image (`image_data:""`) → `localImageUri:null` → the Result screen rendered
the "ITEM" placeholder instead of the cut-out. **Fix: `buildUserPrompt` and
`buildIsolationPrompt` (`generate-item-image/prompt.ts`) are now neutral — they
handle both a worn outfit and a standalone garment — and the function was
redeployed (v5).** The worn-outfit path is unchanged ("may be worn by a person").

**Extraction path — always AI, then on-device cut-out (user-confirmed).** Try On
no longer prefers the on-device extractor (which yields only color+type and would
leave most Verdict criteria as "Not enough info"). `tryOnStore.scan()` now ALWAYS
calls `extractItemsWithImages` (`generate-item-image`) to obtain the item image +
full metadata JSON, then runs `cutoutOnDevice` on the white-bg result to produce a
transparent "cut off background" image (no-op → white-bg fallback when native ML is
absent). Credit-gated unless premium; `method` is always `'ai'`. This is a CLIENT
change — it requires an app reload/rebuild (the three deploy fixes above do not).

### 2026-06-21 — Retry transient Gemini failures (intermittent 500s)

Scan occasionally 500'd from `geminiDetect` when Gemini returned a transient
error (overload/429/5xx) or the key was momentarily unavailable. `geminiDetect`
and `geminiIsolate` now retry up to 3× with backoff on transient statuses
(429/500/502/503/504) and network errors; a genuine 4xx (e.g. bad key) still
fails fast. (The GOOGLE_API_KEY itself was re-verified working — flash returns
200, serviceTier "standard".)

### 2026-06-21 — Auto-add AI colours + engine reads `colors` (Option 2)

The AI knows far more colours than the curated palette, but `clothing_items.color`
has an FK to `colors(name)`. Chosen approach (user): let the AI use richer colour
names and auto-add unknowns, AND make the engine score them.
- **Extraction (`generate-item-image`):** prompt now returns a richer `color`
  name (palette preferred, else a specific name like "Dusty Rose") + `color_hex`.
  `snapColor` keeps canonical palette names but passes richer names through
  (Title-Cased). After detection, **`ensureColors`** (service-role client — the
  table is RLS read-only to users) guarantees the colour is FK-valid:
  (1) exact name already in `colors` → keep; (2) **hex near-identical** (Manhattan
  RGB ≤ 30) to an existing colour → REUSE that colour's name (mutate the garment,
  no insert) so we don't accumulate synonyms; (3) otherwise insert a new colour
  with attributes derived from the hex (HSL → hue/sat/lum/lightness/saturation/
  undertone/family). The FK is on `colors.name`, so the name is always ensured;
  the hex check only de-duplicates. Best-effort; never blocks extraction.
- **Engine (`generate-outfits` + `evaluate-item`):** both load the `colors` table
  per request and call `registerColors`; `enrichment.colorProfileOf` falls back to
  these DB attributes when a colour isn't in the curated `COLOR_MAP`, so richer
  colours score with real hue/undertone instead of the neutral default.
- All server-side (deployed) — no client rebuild needed for colours. Verified the
  computed row shape inserts into `colors` cleanly.

### 2026-06-21 — Add to Wardrobe failed silently (FK 409)

"Add to Wardrobe" did nothing. API logs showed the insert returning **409** —
a foreign-key violation. `clothing_items` has FKs: `material → fabric_types(name)`
(rows are **lowercase**), `type → garment_types(type_key)`, `color → colors(name)`.
The AI scan emits **Title-Case material** ("Cotton") which isn't in `fabric_types`
→ FK fails. (Every prior item had `material = NULL`, so the FK was never hit
before Try On's AI path.) Three controlled types (JUMPSUIT/OVERALLS/GOWN) were
also absent from `garment_types`. Fixes:
- **DB (live):** inserted JUMPSUIT/OVERALLS/GOWN into `garment_types`.
- **Client:** `wardrobeService` lowercases `material` on insert AND update to
  match `fabric_types` (colors stay Title Case — they already match).
- **UX:** the failure was invisible (error rendered up in the scroll, not at the
  sticky bar). `ResultScreen` now shows the add error beside the button and a
  disabled "ADDING…" state, so a failure is never silent again.

### 2026-06-21 — Item selection on scan (A now; B queued)

A scan photo can contain more than one garment, yet `scan()` evaluates the FIRST
detected item (`results[0]`). Chosen approach (user): **A now, B later.**
- **A (done).** Single-item assumption kept; the Scan screen gains a framing guide
  ("ONE ITEM · centre a single piece · plain background") plus the existing hint,
  so the user frames the one item they're considering. No AI cost change.
- **B (BACKLOG — multi-item picker).** When detection finds >1 garment, let the
  user pick which to evaluate. Cost-optimised design: have `generate-item-image`
  detection return a bounding box per item → client shows cheap crops of the
  ORIGINAL photo as a picker (no extra image-gen) → isolate ONLY the chosen item
  (needs an isolate-one mode/param on the edge function). Revisit when needed.

### 2026-06-21 — Wardrobe save preserves PNG transparency

`optimizeImage` previously forced `SaveFormat.JPEG`, so adding a transparent
cut-out to the wardrobe (Try On "Add", or the AI/on-device add wizard) **flattened
the alpha** → the saved item had a solid background, unlike the seeded demo PNGs.
Fixed: the photo pipeline now carries an `ext` ('jpg' | 'png'). `storePhoto`
detects a `.png` source (cut-out) → `optimizeImage(uri, 'png')` (preserves alpha)
and stores `.png` with `image/png` content-type; raw photos stay JPEG. Threaded
through `relativePathFor`/`writeDeviceCopy`/`uploadCloudCopy`/`ensureCloudCached`
(all params optional, default jpg → backward-compatible) plus `addItem` rollback
and `promoteToCloud`. Try On "Add" already passes the full metadata; now it also
persists the transparent PNG, matching the rest of the wardrobe.

### 2026-06-21 — Server-side chroma cut-out (robust transparent PNG)

On-device ML cut-out proved unreliable for AI-generated images (SubjectSegmenter
gates the chroma-key, narrow tolerance, magenta/white halo, holes in same-colour
garments, and absent entirely in Expo Go). Replaced with a deterministic
**server-side keyer** in `generate-item-image`:

- **Dynamic chroma background.** `pickChromaBg(metadata.color)` chooses a saturated
  background that CONTRASTS with the garment (greenish item → magenta; reddish/
  pink/purple → green; else magenta). `buildIsolationPrompt` now asks Gemini for a
  perfectly uniform solid background of that exact colour, and that the garment not
  contain it. (White is unusable — collides with white/cream garments.)
- **`keyChroma` (imagescript, Deno).** Decode → refine the key colour from the 4
  corners → **flood-fill from the borders** (only background connected to the edge
  is removed, so near-chroma pixels INSIDE the garment never punch holes) → soft
  alpha + despill on the 1px boundary → encode transparent PNG. Sanity-checked
  (opaque fraction 5–97%); on any failure or degenerate result it returns the
  original untouched with `keyed:false` and never throws (function can't 500 on
  keying).
- **Client.** The response now carries `keyed` per item. `tryOnStore.scan()` and
  `useAddWizard.refineAiCutout` run the on-device cut-out ONLY when `!keyed`
  (fallback); a keyed transparent PNG is used directly. Works in every environment
  (no native dependency on the happy path). Validated in the edge runtime with a
  synthetic magenta/blue image (flood-fill keyed the magenta, kept the square).
- **Not a guarantee.** Quality still depends on Gemini producing a uniform bg;
  this maximises reliability (dynamic contrast + flood-fill + despill + fallback)
  but cannot be 100% on AI-generated images.

**Convention — AI extract always followed by on-device cut-out.** Every caller of
`generate-item-image` (via `imageGenerationService.extractItemsWithImages`) MUST
run the on-device ML segmenter (`cutoutOnDevice`) on the returned white-background
image to produce a transparent "cut off background" item. Verified callers (both
apply it; safe no-op without the native module): `tryOnStore.scan()` and
`useAddWizard.analyse()` (via `refineAiCutout`). Documented at the call site in
`imageGenerationService.ts` so future callers don't skip it.

**Transient lifecycle.** `tryOnStore` is not persisted. The cut-out image is a
temp file deleted on discard (`reset()`) and after a successful Add (the wardrobe
service has made its own durable copy). Nothing is written before the explicit
Add (FR-013/FR-015, SC-004). Mix & Match consumes no credit and never persists.

### 2026-06-21 — Item detail opened the wrong item (always "Oversized white tee")

Tapping **any** wardrobe item opened the same detail (the first demo item). Root
cause: a **data-source mismatch** in `app/item/[id].tsx`. The Wardrobe grid renders
`appStore.wardrobeItems` (real Supabase-backed `WardrobeItem`s) and navigates with
their ids, but the detail screen resolved the id only against the **demo** catalogue
with a silent fallback: `itemById(id) || items.find(...) || items[0]`. A real
wardrobe id matches neither `ITEMS` (demo) nor `items` (demo store), so it always
fell through to `items[0]` = `i_tee_white` ("Oversized white tee").

Fix (client only — app reload, no redeploy):
- Resolve **`wardrobeItems` first**, then the demo catalogue; the `|| items[0]`
  fallback is removed — an unknown id now shows an explicit "Item not found" state
  instead of a wrong item.
- Both shapes (`WardrobeItem` and demo `ClothingItem`) are normalized to one
  `ItemVM` so the JSX renders uniformly. Wardrobe fields map as: `type`/`category`,
  `colors`/`primaryColor`, `sizeLabel`→size, `createdAt`→added month, and the
  feature-006 garment `measurements` object (`m_chest`…`m_shoe_size`) → the labeled
  CM/IN grid (by-type defaults when absent). Wear-count/"Wear with" stay demo-only.
- The hero image now resolves through `useItemPhoto` (cloud/local/asset) instead of
  the demo-only `item.png`, and Remove routes to `removeWardrobeItem` vs `removeItem`
  by source.

### 2026-06-21 — "Build an outfit" in item detail → live Mix & Match

The item-detail "Build an outfit" button did nothing for real wardrobe items: it
only ran `outfitsUsing[0] && router.push('/outfit/...')`, and `outfitsUsing` (demo
`OUTFITS` referencing demo ids) is always empty for wardrobe items. Chosen
behaviour (user): build outfits around the item with the **real fit engine** by
reusing the existing Mix & Match pin path — no new backend.

- **`tryOnStore.pinWardrobeItem(item)`** (new) maps a `WardrobeItem` → a transient
  `ScannedItem` (synthetic pin id `'scanned'`, controlled-vocab `GarmentMetadata`
  from the item's type/color/material/fit/pattern/warmth/measurements) and sets it
  as `scannedItem`. The item detail button then navigates to `/try-on/mix-match`,
  whose `MixMatchFeed` fetches on mount → `generate-outfits` with `pin_item`, so
  every returned outfit includes this item. Reuses the whole US2 path unchanged;
  consumes no credit; persists nothing. Demo catalogue items keep the old
  open-existing-outfit behaviour.
- **Data-loss guard.** The pinned `ScannedItem` reuses the item's **durable**
  wardrobe photo (`photoLocalUri ?? photoUrl`), so a new `keepImage` flag on
  `ScannedItem` makes `reset()`/`addToWardrobe` skip `cleanupTempImage` for it —
  without this, leaving the feed would delete the real wardrobe file (local items
  have a `file://` uri that the temp-cleanup would otherwise remove). Transient AI
  scans are unaffected (no flag → still cleaned up). `pinWardrobeItem` also cleans
  up any prior *transient* scan first so its temp cut-out doesn't leak.
- Client only — app reload, no redeploy. (Two pre-existing `tryOnStore.scan()`
  on-device tests remain stale from the earlier "always AI" refactor; unrelated.)

### 2026-06-21 — "Edit item" in item detail (was a dead button)

The item-detail Edit icon had no `onPress`. There was no wardrobe-item edit screen
at all (`updateWardrobeItem` / `UpdateItemInput` existed and supported every field,
but nothing called the update path from the UI).

- **New route `app/item-edit.tsx`** (registered in `app/_layout.tsx`). It reuses the
  add-wizard **`ItemCard`** editor verbatim, so the edit UI, controlled vocabulary,
  and type-aware measurement fields are identical to the Add flow (no second source
  of truth). The screen maps `WardrobeItem` → the editable `ExtractedItem` shape on
  entry and back to `UpdateItemInput` on save, then calls `updateWardrobeItem`;
  cleared values map to `''`/`[]` so the service NULLs the column. On failure it
  surfaces `wardrobeError` and stays put; on success it returns and the detail screen
  re-renders from the updated store item.
- The Edit icon is shown **only for real wardrobe items** (`vm.isWardrobe`) — demo
  catalogue items aren't persisted, so editing them through the wardrobe service
  would fail. (The Share icon remains unwired — out of scope.)
- Client only — app reload, no redeploy.

### 2026-06-21 — Item image showed a placeholder (Mix & Match pin + Edit thumbnail)

Both new surfaces showed a placeholder instead of the item's photo. Root cause:
they read `WardrobeItem.photoLocalUri ?? photoUrl`, but those are **in-memory-only**
fields that are **unset in the store** — the persisted location is `photoPath`, and
the image is resolved per-component via `useItemPhoto` (cloud/local/asset). Nothing
populates the resolved uris into the store, so both were null → placeholder. (Owned
pieces already rendered: they resolve through `OutfitItemThumb` → `useItemPhoto`.)

- New tiny helper `photoSourceUri(source)` (wardrobe-photos) pulls the string uri
  out of a resolved `useItemPhoto` source (`{ uri }`; null for bundled-asset numbers).
- **Mix & Match:** `pinWardrobeItem(item, imageUri?)` now takes the caller's resolved
  uri; the item-detail screen passes `photoSourceUri(photo.source)` (it already runs
  `useItemPhoto` for the hero), so the pinned candidate in `MatchFeedCard` renders.
- **Edit:** `item-edit` runs `useItemPhoto(original)` and feeds the resolved uri into
  the `ItemCard` thumbnail (`{ ...draft, localImageUri: resolvedUri }`); the draft
  itself still carries the unset value, but the card always shows the real photo.
- Client only — app reload, no redeploy.

### 2026-06-24 — Magenta fringe on AI item cut-outs (server keyer hardened)

Items still showed a magenta (hồng cánh sen) halo, and often the returned image
still had the full magenta plate — i.e. the server keyer was falling back to
`keyed:false` and the on-device ML cut-out (which does NO despill) left the
anti-aliased fringe. Two root causes in `chromaKeyBitmap` (`generate-item-image`):

1. **Flood-fill too tight.** `TOL=72` stalled on the AI's slightly uneven
   background lighting/gradient, leaving most of the magenta plate → opaque
   fraction stayed > 0.97 → degenerate guard tripped → `keyed:false`. Raised to
   **`TOL=110`**; connectivity from the border still protects interior pixels, so
   no holes. This is what removed the "still has magenta bg" symptom.
2. **Despill only 1px wide.** The old pass despilled/feathered only the single
   boundary ring, but the AI's anti-aliasing is 2–4px, so pixels just inside kept
   their magenta tint at full opacity → visible halo. Replaced with an **edge
   BAND** (BFS distance from the cut, ~3px at 1K): across the whole band the alpha
   is feathered by a generic **chroma-ness** metric (`magenta: min(R,B)−G`;
   `green: G−max(R,B)`) and the key channels are despilled (clamped to the non-key
   level + small margin). Interior garment pixels are untouched. The metric is
   safe because `pickChromaBg` never puts a magenta-dominant garment on a magenta
   bg (and vice-versa for green), so a real garment edge reads ~0/negative.

- Server only — **redeploy `generate-item-image`** (`npx supabase functions deploy
  generate-item-image`); no app rebuild, no client change (still gated on `!keyed`,
  but the happy path now reliably returns a clean `keyed:true` PNG so on-device ML
  rarely runs). Single Supabase env → deploy hits production.

### 2026-06-24 — Item measurements estimated from the user's body as a scale

Both scan flows (Try-On scan and Add-to-Wardrobe scan) had Gemini estimate each
garment's measurements **from pixels alone** — no real-world scale, so the numbers
were weak, which in turn weakened the Try-On fit/measurement verdict (`evaluate-item`
compares item measurements to the user's body). Now the detector is given the
**user's own body measurements as a ruler**:

- `generate-item-image` loads the caller's `body_measurements` (RLS-scoped to them,
  best-effort, same row `evaluate-item` reads) and passes a short scale string into
  the detection prompt via the new `formatBodyScale` + `buildUserPrompt(notes, bodyScale)`.
- The prompt is **conditional**: use the body as a scale + the visible fit (tight/
  loose, shoulder overhang, sleeve break, where hems fall) ONLY when a person is
  wearing the items (assumed to be the user); for standalone shots (hanger/flat-lay)
  or an obviously different body, fall back to typical sizing. The numbers are a
  measuring aid only — they can't change the field set / vocab / JSON-only rule.
- Privacy: body measurements never leave the function boundary except to the same
  vision model the photo already goes to; nothing extra travels from the client.
- Both flows benefit from one change (shared edge function). Add-to-Wardrobe shows
  the populated values in the editable `ItemCard`; Try-On feeds them straight into
  the verdict. Server only — **redeploy `generate-item-image`**, no app change.

### 2026-06-24 — Outfit feed: quality gate (stop padding with weak outfits)

User report: the feed shows many visibly bad outfits. Root cause was NOT scoring —
it was that nothing **used** the score to filter:

- **No quality floor anywhere.** `rankCandidates` returned the top `TOP_N=24` with
  no cutoff; `index.ts` then `slice(0,10)`. The feed always padded to ~10 outfits
  even when the only options were mediocre ("best available" ≠ "good").
- **`dailyShuffle` scrambles score order** (shuffles within tier thirds), so the
  highest-scored outfits weren't at the top and weak ones surfaced high.
- **Metadata audit** (68 items / 3 wardrobes, live DB): `type` 68/68, `color` 68/68,
  measurements 61/68 — but `fit` 1/68, `material` 1/68, `pattern`/`primary_color`/
  `warmth` ≈0. The engine falls back to **type-derived** fit/material/warmth, so
  proportion/texture/statement are near-constant per type → scores cluster → the
  shuffle dominates the perceived order. Data isn't garbage (type+color+measure are
  solid) so a floor is viable, but the missing per-item fit/pattern caps how well
  scoring can separate outfits (a future enrichment opportunity).

Fix (server, `generate-outfits/index.ts`): a **quality gate** before the shuffle —
`applyQualityGate(ranked)` drops outfits below `max(MIN_QUALITY=0.50, best−QUALITY_BAND=0.18)`,
so the shuffle only reorders genuinely good options and a stingy curator can't
backfill junk. Shows fewer when few qualify rather than padding, but never fewer
than `MIN_FEED=3` (no empty feed). **Mix & Match (pinned item) skips the gate** —
the user explicitly wants combos around their item. Constants are tunable; each
outfit's score is already logged (`outfit #n … score=…`) so the cut can be
calibrated against real feeds. Server only — **redeploy `generate-outfits`**.

### 2026-06-25 — Women's-wear vocabulary (controlled garment types)

Audit question: is the app biased toward menswear? Verdict — **not biased; it was
gender-blind and the type vocabulary leaned generic/menswear.** The outfit engine
already supports women's items conceptually (dress/skirt/blouse/heels were present,
scoring is gender-neutral, try-on passes `gender` to the image model), but the
**controlled garment vocabulary** lacked many common women's pieces, so they could
only be catalogued by snapping to a near-miss type.

Added **14 new controlled types** (reference cross-checked against the full A–Z
contents of *The Visual Dictionary of Fashion Design*, pp.12–15 — which notably
has separate "Measurements (men)" / "Measurements (women)" entries, confirming the
broader women's taxonomy):

- tops: `CAMISOLE`, `CROP`, `BODYSUIT`, `TUNIC`, `CORSET`
- bottoms: `LEGGINGS`
- outerwear: `CAPE`, `KIMONO`
- footwear: `FLATS`, `WEDGES`
- accessories: `EARRINGS`, `GLOVES`, `TIGHTS`, `TIE`

`TIE` (neckwear) was the one genuinely-new visible garment with no prior
representation; **swimwear and lingerie were reviewed but deliberately left out of
scope** for a daily-outfit recommendation app (the book lists Bikini, Bra,
Lingerie, Petticoat, Garter, Thong, etc. — a decision point, not an oversight).

Plus a wide alias layer routing book terms / synonyms to existing or new types:
- women's: TANK→CAMISOLE, ROMPER→JUMPSUIT, CULOTTES/CAPRIS/JODHPURS→TROUSERS,
  KILT/MINISKIRT/TUTU→SKIRT, PUMPS/STILETTO→HEELS, MARY JANE→FLATS, PONCHO/STOLE→
  CAPE/SCARF, BOLERO/SHRUG/TWIN SET→CARDIGAN, HALTER/SPAGHETTI STRAP→CAMISOLE,
  BANDEAU→CROP, BUSTIER/BASQUE/BODICE→CORSET, COCKTAIL DRESS/PINAFORE→DRESS,
  HOSIERY→TIGHTS
- neckwear/headwear/coats (incl. menswear): NECKTIE/BOWTIE/CRAVAT/ASCOT→TIE,
  FEDORA/PANAMA/BONNET/DEERSTALKER/FEZ/BALACLAVA/TURBAN/TOP HAT/BERET/HELMET→HAT,
  BANDANA→SCARF, DUFFEL/MACKINTOSH→COAT, TUXEDO/MAO SUIT/SAFARI SUIT→BLAZER,
  BOOTLEG/BOOTCUT→TROUSERS

Because the engine **silently falls back** on an unknown type (→ `accessory` /
`regular` fit / `2.5` formality / empty style tags), every type-keyed map was
updated in lockstep across **9 files**:

- `generate-item-image/prompt.ts` — `TYPES`, `TYPE_ALIASES`
- `generate-outfits/engine/enrichment.ts` — `CATEGORY_MAP`, `STYLE_AFFINITIES`,
  `TYPE_DEFAULT_FIT`, `TYPE_FORMALITY`, `LOUD_TYPES`
- `src/features/wardrobe-add/vocab.ts` — `TYPE_OPTIONS`, `CATEGORY_BY_TYPE`
- `src/features/wardrobe-add/measureSchema.ts` — bottom/shoe/no-measure sets
- `src/services/itemTypeMap.ts` — on-device label → type rules
- `src/components/outfit/Collage.tsx` — anchor/outer/inner/accessory roles + `ASPECT`
  (also fixed a pre-existing gap: `HEELS`/`OXFORDS` were missing from the shoe set,
  so heels rendered in the wrong collage zone)
- `src/services/wardrobeService.ts` — `inferCategory` fallback (also fixed `SKIRT`
  → was mis-bucketed as `accessory`)
- `app/build.tsx` — widened `BUILDER_BUCKETS` whitelists to include the new + many
  already-existing types (the manual builder was very narrow)

DB safety: verified live `clothing_items.type` is a plain `varchar` with **no CHECK
constraint**, so new type values insert freely — no migration needed.

Known follow-ups (not done here): (a) the slot-based manual builder (`app/build.tsx`)
still has no dresses/one-piece bucket — adding one is a UX decision; (b) the outfit
engine remains gender-blind — wiring `gender` into `EngineContext`/scoring is a
separate enhancement. Backend changes require **redeploy of `generate-item-image`
and `generate-outfits`**.

### 2026-06-25 — Collect waist for tops (activate dormant `waist_top` fit scoring)

Audit question: are top garment measurements complete? Verdict — the 4 collected
keys (`m_chest`, `m_shoulder_width`, `m_body_length`, `m_sleeves`) cover the big
fit signals, but the engine's `TOP_MAPPINGS` (`scoring.ts`) **already scores
`waist_top`** (and `waist_outer` for outerwear, `waist_top` for one-piece) against
`body_waist` — yet **nothing populated it for tops**, so it was always null/skipped.
The whole downstream path already existed: `m_waist` is in the engine SELECT, `M_COLS`
maps it, and `parseMeasurements` routes `waist` → `waist_top`/`waist_outer`/`waist`
by category. Only the **ingest side** never supplied a value for tops.

Note: `waist_top` and `waist` (bottom) currently share identical thresholds
(`[2,6]/[0,10]`); the split exists so they *can* diverge later. `waist_outer` is
genuinely looser (`[4,8]/[0,14]`) for layering.

Fix — ingest only, **no migration** (`m_waist` column already exists, shared):
- `generate-item-image/prompt.ts` — added `m_waist` to the tops/outerwear/one-piece
  measurement key list the model estimates. **Requires redeploy** of `generate-item-image`.
- `src/features/wardrobe-add/measureSchema.ts` — added `{ m_waist, 'Waist' }` to the
  `top` `MEASURE_FIELDS` group (shown in the review card + Try-On result + ItemCard,
  all data-driven) and a `m_waist: 50` `top` default (used by on-device Extract-by-item).

Not done here (lower ROI, deferred): `upper_arm` (engine scores it for tops/outerwear
but it needs a new `m_upper_arm` column + AI estimate); per-type review card (e.g.
collar/`neck` only for shirts). `m_rise` (estimated + stored but unscored — no
`PANTS_MAPPINGS` entry) and `m_skirt_length` (not even SELECTed by the engine) remain
dead weight — either wire into scoring or drop from the AI prompt in a later pass.

### 2026-06-25 — Seasonal-weather colour matching (light/bright in summer, dark in winter)

Audit question: does the feed match colour to the current season (cold→dark/cool,
hot→light/bright)? Verdict — **no, it did not.** Three easily-confused things existed
but none did weather-driven colour:
- **"Season Match"** (`scoreSeasonMatch`) scores FABRIC weight vs season (wool↔winter,
  linen↔summer) — never colour. And it was effectively **dormant**: its `targetSeason`
  came only from `intent.seasonOverride`, which is almost always unset.
- **`colorSeason`** (`SEASON_FLATTERING`) is **personal colour analysis** (the user's
  skin undertone — spring/summer/autumn/winter *of the person*), static, not weather.
- No code linked colour to the actual current season, and the engine never even
  received a temperature/season signal.

Decision (anh Khôi): derive season from **date + hemisphere** (no weather API), model
the colour rule on **lightness + saturation** (the stronger fashion convention:
summer/spring = lighter & brighter, winter/autumn = darker/deeper), as a **small nudge
that stays subordinate to the personal palette**.

Implementation (engine, all server-side):
- `types.ts` — new `EngineContext.weatherSeason?: Season` (distinct from `colorSeason`).
- `index.ts` — derive `weatherSeason = intent.seasonOverride ?? seasonForMonth(month,
  hemisphere)`. Hemisphere is best-effort from `profiles.location_country` (we store no
  coords): a small Southern-hemisphere name set flips it, default Northern (covers the
  VN user base; equatorial → Northern is harmless). Added `location_country` to the
  profile SELECT.
- `scoring.ts` — new pure `seasonForMonth(month, hemisphere)`; new `weatherSeasonColorBonus`
  using each colour's `lum`/`sat`, **capped at ±0.08** (below the personal-season bonus so
  the user's palette stays primary). **Neutral-undertone staples (black/white/grey/
  charcoal) are exempt** — a black coat in summer / white tee in winter isn't penalised.
  `scoreColorHarmony` gained an optional `weatherSeason` param (backward-compatible, so
  `evaluate-item` is unaffected).
- `ranking.ts` — passes `ctx.weatherSeason` to `scoreColorHarmony` AND to
  `scoreSeasonMatch` (so the previously-dormant **fabric** season matcher now also runs
  on the real season — "no wool in summer" comes along for free). Curator prompt's
  season line now uses the derived season too.
- Test: `engine/season-color.test.ts` (Deno) covers month→season per hemisphere, the
  light/dark bias direction, and neutral exemption.

Effect is gentle by design: colour dim weight is 0.25 and the bonus caps at ±0.08, so
max ±0.02 on total score — a re-ranking nudge, not a hard filter. Real-world impact is
further muted today because item `material` is ≈NULL (fabric season collapses to
`allSeason`), so the fabric-season half barely moves until metadata improves. **Redeploy
`generate-outfits`** (done). A real weather/temperature API is a future upgrade;
constants are tunable.

### 2026-06-25 — Seasonal colour: hemisphere map + extend to Try-On Verdict

Follow-up to the entry above (items #1 and #3 of its "future upgrades").

**#1 — Hemisphere accuracy.** Investigated capturing real GPS for a precise hemisphere
and found the blocker: the onboarding **location is a hardcoded placeholder**
(`app/(onboarding)/location.tsx`: `const DETECTED = 'Ho Chi Minh City, Vietnam'`) — no
`expo-location` call, no coordinates persisted anywhere (only `location_city`/
`location_country` strings). Real per-user coords would need a GPS pipeline + a new
column + migration (a separate, larger task — flagged, not done). The proportionate fix:
made `hemisphereForCountry` **comprehensive** (full Southern-hemisphere country set incl.
Brazil/Oceania/Southern Africa, was a short partial list) and **promoted it into the
shared engine** (`engine/scoring.ts`, exported) so both edge functions use one copy
instead of a duplicated helper in `generate-outfits/index.ts`.

**#3 — Try-On Verdict is now season-aware.** `evaluate-item` previously scored an item's
Colour and Fabric with no weather season. Now it derives `weatherSeason` the same way
(date + `hemisphereForCountry(location_country)`) and threads it through:
- `evaluate-item/index.ts` — added `location_country` to the profile SELECT; derives
  `weatherSeason`; passes it into `computeVerdict`.
- `evaluate-item/scoring.ts` — `ProfileInputs.weatherSeason`; the **Colour** criterion
  passes it to `scoreColorHarmony` (same light/bright-summer, dark-winter nudge as the
  feed); the **Fabric** criterion now calls `scoreSeasonMatch([item], weatherSeason)` so
  a wool item scanned in summer scores lower. So a scanned item's Verdict reflects the
  current season just like the feed.

Tests extended (`engine/season-color.test.ts`) with `hemisphereForCountry` cases.
**Redeployed `generate-outfits` + `evaluate-item`** (both smoke-tested). Still deferred:
real GPS/coords capture in onboarding, and a live weather/temperature API.

### 2026-06-25 — Real GPS location capture in onboarding (makes season per-user)

Closes the "real location" gap from the entry above: the onboarding location screen
was a **hardcoded placeholder** (`'Ho Chi Minh City, Vietnam'` + fake "27°C") with a
dead "Edit location" link, so every user's country was effectively Vietnam → the
seasonal feature, while correct, was the same for everyone.

Chosen approach (anh Khôi): **GPS auto-detect, user-editable.**
- Added `expo-location` (~19.0.8) + its config plugin in `app.json`
  (`locationWhenInUsePermission`). **Native dependency → requires a new EAS/dev build**
  to take effect; cannot be exercised in the current binary.
- New `src/services/locationService.ts` — `detectCurrentLocation()`: requests
  foreground permission, takes one low-accuracy fix, reverse-geocodes to a
  "City, Country" label. Returns `null` (never throws) on denied/no-fix/miss so
  onboarding is never blocked (location is optional).
- Rewrote `app/(onboarding)/location.tsx`: auto-detects on mount and **pre-fills an
  editable field** (functional setState so a fast typer is never overwritten); removed
  the hardcoded location + fake weather + dead link; honest states for
  detecting / detected / permission-denied. Stored via the existing
  `setProfile({ location })` path (no schema change).

Hemisphere flows through the country signal — see the ISO-code entry below, which
removes the locale limitation. **No redeploy for the screen itself** (client + config),
but it **needs an app rebuild** to ship (native `expo-location`).

### 2026-06-25 — Locale-proof hemisphere via stored ISO country code

Hardening for the GPS entry above: reverse-geocoding returns the country in the
**device locale**, so a Southern-hemisphere country on a non-English phone (e.g.
"Brasil", "Südafrika") would miss the English-keyed name map and wrongly default to
Northern → wrong season. Fixed by persisting the locale-independent **ISO 3166-1
alpha-2 code** and preferring it.

- **Migration** `20260625000001_profiles_location_country_code.sql` — `profiles.location_country_code text`
  (nullable, idempotent `add column if not exists`). Applied to live DB.
- `locationService.detectCurrentLocation()` now also returns `isoCountryCode`.
- `location.tsx` stores the code **only when the field still matches the auto-detected
  label** (a manual edit clears it → server falls back to the name map for the typed value).
- `profileService` — `ProfilePatch.locationCountryCode`; writes `location_country_code`
  (upper-cased). `authStore.setProfile` already forwards the whole patch, so no store change.
- Engine `scoring.ts` — new `resolveHemisphere(code, name)`: ISO code wins (exact set of
  Southern-hemisphere codes), else the name map, else Northern. Both `generate-outfits`
  and `evaluate-item` now SELECT `location_country_code` and call `resolveHemisphere`.
- Tests extended (`season-color.test.ts`) — ISO wins, case-insensitive, localised-name
  fallback.

**Redeployed `generate-outfits` + `evaluate-item`** (smoke-tested). The client half still
**needs the app rebuild** (shared with `expo-location`) to populate the new column; until
then existing rows have a null code and fall back to the name map (Northern for the VN
base — unchanged behaviour).
