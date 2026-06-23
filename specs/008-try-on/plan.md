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
