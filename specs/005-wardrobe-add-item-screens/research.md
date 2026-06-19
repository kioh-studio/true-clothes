# Research: Wardrobe Add-Item Screens

**Feature**: `005-wardrobe-add-item-screens` | **Date**: 2026-06-17

---

## D1 — Per-photo cost avoidance in batch AI analysis

**Decision**: Client-side `Map<photoId, ExtractedItem[] | 'failed'>` is the result cache.
On retry, `aiAnalysisService.ts` reads the map and only submits photos with no entry (or a
`'failed'` entry). The Edge Function is stateless per request — it never needs to know which
photos were previously attempted.

**Rationale**: Re-submitting an already-analysed photo doubles the AI API cost with no
benefit. The client is the natural place to track per-photo state because it owns the wizard
session. The Edge Function returning `{ photoId, status, items }` per photo makes it
straightforward to merge new results into the existing map.

**Alternatives considered**:
- Server-side session state (Redis / Supabase KV): more complex, requires session ID
  management, no benefit for a single user session.
- Idempotency key per photo (vendor-side dedup): vendor-dependent, not applicable to MVP
  simulated analysis.

---

## D2 — JSONB measurements schema

**Decision**: Store type-aware measurements as a JSONB column on `clothing_items`.
Keys are human-readable field names; values are strings with metric unit suffix.

Examples:
```json
top:    { "chest": "54 cm", "shoulder": "46 cm", "length": "72 cm", "sleeve": "62 cm" }
bottom: { "waist": "82 cm", "hip": "96 cm", "inseam": "78 cm", "length": "106 cm" }
shoe:   { "size": "EU 42", "insole": "27 cm" }
bag:    { "width": "32 cm", "height": "24 cm", "depth": "12 cm" }
```

**Rationale**: Type-aware field sets have significant overlap only at the category level. A
flat relational schema would require 10+ nullable columns most of which are always null for
any given item. JSONB is queryable in Supabase Edge Functions via
`(measurements->>'chest')::numeric >= 92`. Schema extensible without migrations.

**Queryability note**: For MVP, measurement-based filtering runs inside the Edge Function
after fetching items. If needed, a GIN index can be added:
```sql
create index idx_clothing_items_measurements on public.clothing_items using gin (measurements);
```

**Alternatives considered**: Dedicated typed columns (e.g. `chest_cm numeric`, `waist_cm
numeric`) — rejected due to high sparsity and schema rigidity across item types.

---

## D3 — expo-image-picker multi-select (AI wizard)

**Decision**: Use `ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true })`
for the AI wizard Upload step's library picker.

**Rationale**: `allowsMultipleSelection` is supported on iOS (via the native system Photos
picker, iOS 14+) and Android (via ACTION_OPEN_DOCUMENT with EXTRA_ALLOW_MULTIPLE, Android
5+) in expo-image-picker v15+. No custom picker implementation required.

**Constraint**: The `selectionLimit` option (iOS 14+) can cap selection to a reasonable
number (e.g. 10) to prevent runaway analysis costs. Set `selectionLimit: 10`.

**Alternatives considered**: A custom multi-select grid overlay — unnecessary given native
picker support; adds UI complexity with no UX benefit.

---

## D4 — BottomSheet vs Modal presentation

**Decision**:
- **Method sheet** and **single-item flow** (guide, processing, review): use the existing
  `BottomSheet` component from `src/components/ui/BottomSheet.tsx`. Height adjusts per step
  (guide: 70%, processing: 60%, review: 92%).
- **AI wizard** (full-screen 4-step): use React Native `Modal` with `animationType="slide"`
  from bottom. The wizard is a separate full-screen surface distinct from the method sheet.

**Rationale**: `BottomSheet` is already used in `wardrobe.tsx` and has the correct design
token styling. A separate `Modal` for the AI wizard avoids nesting sheets and gives the
wizard its own navigation-independent surface.

**Alternatives considered**: Expo Router modal route for the AI wizard — would require a
new `app/` file for the wizard and complicate the onboarding-context launch path. Modal
component keeps wizard state fully in-memory and avoids route-level complexity.

---

## D5 — Wardrobe Intro → "ADD FIRST ITEM" integration

**Decision**: `wardrobe-intro.tsx` renders `MethodSheet` as a state-controlled overlay
within the onboarding screen. A `boolean` local state (`methodSheetOpen`) controls
visibility. When the user saves an item from within the sheet, the screen calls
`completeOnboarding()` then `router.replace('/(tabs)')`.

**Rationale**: Keeps the onboarding navigation stack intact. The method sheet component is
purely presentational and renders correctly as an overlay on any screen. No route change is
needed to present the sheet.

**Onboarding navigation change** (colors.tsx):
- Current: `handleContinue` → `router.push('/(onboarding)/complete')`
- New: `handleContinue` → `router.push('/(onboarding)/wardrobe-intro')`
- The existing `/(onboarding)/complete` screen's role is absorbed into `wardrobe-intro`.

---

## D6 — Navigation audit for /add-item references

All three callers confirmed and disposition decided:

| File | Current usage | Change |
|------|--------------|--------|
| `app/(tabs)/wardrobe.tsx` FAB | `router.push('/add-item')` | Open `MethodSheet` via hook state |
| `app/collections/[id].tsx` | TextLink "Go to wardrobe" → `/add-item` | Navigate to `/(tabs)/wardrobe` (no sheet) |
| `app/_layout.tsx` | `Stack.Screen name="add-item"` | Remove Stack.Screen entry |

---

## D7 — Edge Function: simulate vs real vision API

**Decision**: MVP Edge Function (`supabase/functions/analyse-outfit-photos/index.ts`)
returns a deterministic stub response with the same shape as a real vision API response.
The response contract (types, status codes, error shapes) is production-ready so v2 can
swap the inner AI call without touching the client.

**Stub behaviour**: For each photo in the request, the function returns 1–2 simulated
`ExtractedItem` objects with plausible attribute values. Processing delay is simulated via
a 1.5-second sleep per photo to allow the client's scanning animation to render.

**Alternatives considered**: No Edge Function in MVP (client-side simulation only) — rejected
because the client contract (calling an Edge Function, handling per-photo status, retrying
failures) must be exercised in MVP to validate the integration path.

---

## D8 — Single-item flow: on-device attribute detection

**Decision**: In MVP, attribute detection (background removal, type/colour/material
classification) is simulated by returning deterministic defaults after a 2.2-second delay
(matching the existing `AddItemSheet` in `wardrobe.tsx`). The processing step UI animates
independently of the actual detection time.

**Rationale**: Real ML integration (CoreML / TFLite) is a v2 concern noted in the spec's
Assumptions. The simulated delay gives the UI enough time to demonstrate the processing
animation and keeps the review step populated with plausible defaults for testing.
