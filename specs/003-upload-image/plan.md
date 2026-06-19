# Implementation Plan: Wardrobe Item Image Upload & Storage

**Branch**: `004-upload-image` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-upload-image/spec.md`

## Summary

Introduce tiered storage for wardrobe item photos. Free users keep photos on-device (only a reference is persisted) and are warned the photos are device-bound; premium users get photos backed up to the private Supabase `wardrobe-photos` bucket, fetched via expiring signed URLs and cached on-device for offline/instant repeat viewing. On upgrade, existing on-device photos migrate to the cloud. All photos are resized on capture (long edge ≤ ~1600 px, ~200–500 KB). Rendering is unified behind a single "resolve item photo to a local file" layer so every surface (wardrobe grid, item detail, collage, feed thumbnails) renders identically regardless of tier, with a graceful placeholder when a photo is missing.

The change reworks the existing `wardrobeService.addItem` path (which today always uploads and incorrectly uses `getPublicUrl()` on a private bucket) into a tier-aware storage service, adds a `photo_storage` discriminator to `clothing_items`, and adds a thin photo-resolution + migration layer.

## Technical Context

**Language/Version**: TypeScript (strict mode), React 19.1, React Native 0.81.5, Expo SDK (expo-router ~6.0)

**Primary Dependencies**: `expo-image-picker` (capture/select), `expo-image-manipulator` ~14 (resize/compress), `expo-file-system` ~19 (device storage + base64 read), `@supabase/supabase-js` (Storage + Postgres), Zustand v5 (state), `react-native-purchases`/RevenueCat (premium tier signal via `usePremium` → `fitEngineStore.premium`)

**Storage**:
- Cloud (premium): Supabase Storage private bucket `wardrobe-photos`, path `{userId}/{itemId}.jpg`, accessed via short-lived signed URLs
- Device (free + premium cache): `FileSystem.documentDirectory` under `wardrobe-photos/{itemId}.jpg`
- Metadata: Postgres `clothing_items` (adds `photo_storage` discriminator)
- Store persistence: AsyncStorage via existing Zustand stores

**Testing**: Jest + existing `src/**/__tests__/` unit suites; service-level tests for storage routing, resize, signed-URL resolution, and migration

**Target Platform**: iOS + Android via Expo (no web target)

**Project Type**: Mobile app (Expo Router file-based)

**Performance Goals**: Feed renders at 60 fps; stored photo long edge ≤ ~1600 px and ~200–500 KB (SC-009); local photos render effectively instantly; first cloud fetch within a few seconds on typical connection (SC-002)

**Constraints**: Offline-capable (free always; premium via on-device cache, FR-008a); cloud photos private with expiring access (FR-016); no rollback mechanism (Constitution V) — local-first write then async cloud sync with automatic retry; one photo per item

**Scale/Scope**: Personal wardrobes (tens–hundreds of items/user, one photo each); affects wardrobe add/edit/delete, upgrade migration, and all item-rendering surfaces

**Unknowns**: None blocking — all spec ambiguities were resolved in `/speckit-clarify` (Session 2026-06-14). Schema-drift risk (live DB vs. migrations) is handled as a verification step in Phase 0, not an open design question.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Applies? | Resolution |
|---|------|----------|------------|
| I | Luxury Minimalist Design (NON-NEGOTIABLE) | **Yes** — new UI: on-device-only disclosure (FR-017), photo placeholder, premium loading state | All new UI uses `src/design/tokens.ts` (no inline hex), hairline icons, full-bleed imagery, no shadows/gradients. Placeholder + disclosure designed in `src/design/**/design.md`. **PASS (design-time)** |
| II | Thin Screens / Logic Separation (NON-NEGOTIABLE) | **Yes** | All storage/resize/routing logic lives in services + a feature hook/store action; screens only render state and dispatch. No `async` in JSX, no `useState` for item data. **PASS** |
| III | Service Abstraction Layer (NON-NEGOTIABLE) | **Yes** — touches Supabase Storage + DB | All access stays inside `wardrobeService` / new `itemPhotoService`; screens/stores never import `sb`. Service returns camelCase domain objects; signed-URL/snake_case stays internal. **PASS** |
| IV | Type Safety & Domain Integrity (NON-NEGOTIABLE) | **Yes** — extends `WardrobeItem`, adds storage discriminator | New fields added to `src/types/fitEngine.ts` (`WardrobeItem`); `photo_storage` typed as a string union; no `any` (use `unknown` + guards). Units N/A; colors unaffected. Service owns camelCase↔snake_case. **PASS** |
| V | Dual-Persistence Architecture | **Yes** — this feature *is* persistence | Local-first: write device copy + DB row immediately, sync to cloud asynchronously with retry. No scoring/ranking change → fit-engine dual-copy rule **not triggered**. Divergence-on-failure accepted per Constitution V and surfaced via recoverable upload state (FR-012). **PASS** |
| VI | Feature Self-Containment | **Yes** | New logic lives under `src/features/wardrobe-photos/` (hook + types) and the shared `src/services/` layer; cross-feature use (premium tier, wardrobe store) flows through stores/services, not direct feature imports. **PASS** |
| WF | Schema change → migration file required | **Yes** | New migration `supabase/migrations/2026XXXX_clothing_items_photo_storage.sql` adds the `photo_storage` column. Bucket is already private (`20260606000003_storage_policies.sql`); RLS unchanged. **PASS** |
| WF | Demo account must remain functional | **Yes** | Demo seed items (`src/config/demo.ts`, `ITEMS`) keep using bundled `png` assets; resolution layer falls through to bundled assets for demo items. **PASS** |

**Initial gate result: PASS** (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/003-upload-image/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── storage-and-service.md   # Service API + storage layout + DB column contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── wardrobe-photos/                # NEW — feature module (Principle VI)
│       ├── useItemPhoto.ts             # resolve item → renderable local uri; loading/placeholder state
│       ├── useUpgradePhotoMigration.ts # drive free→premium local→cloud migration
│       └── types.ts                    # PhotoStorageKind, ResolvedPhoto (feature-local types)
├── services/
│   ├── wardrobeService.ts              # MODIFIED — tier-aware add/update/delete; signed URLs (not public)
│   ├── itemPhotoService.ts             # NEW — device storage, resize, cloud up/download, signed-url + cache
│   └── supabase.ts                     # unchanged singleton
├── types/
│   └── fitEngine.ts                    # MODIFIED — WardrobeItem gains photoStorage + photoLocalUri
├── stores/
│   └── appStore.ts                     # MODIFIED — addWardrobeItem passes tier; migration trigger on upgrade
├── components/
│   ├── ui/                             # placeholder primitive (if not already present)
│   └── outfit/Collage.tsx              # MODIFIED — render via resolved photo (local uri)
└── design/
    └── wardrobe-photos/design.md       # NEW — placeholder + on-device-only disclosure specs

app/
├── add-item.tsx                        # MODIFIED — show FR-017 disclosure for free users
└── (tabs)/wardrobe.tsx, item/[id].tsx  # MODIFIED — render via useItemPhoto, placeholder, re-add action

supabase/
└── migrations/
    └── 2026XXXX_clothing_items_photo_storage.sql   # NEW — photo_storage column + backfill
```

**Structure Decision**: Extend the existing Expo Router app (`app/` screens) + `src/` layered architecture. Storage/IO mechanics live in `src/services/` (Principle III); orchestration/derived state in a self-contained `src/features/wardrobe-photos/` module (Principle VI); shared domain types in `src/types/`. No new top-level projects.

## Complexity Tracking

> No Constitution violations — section intentionally empty.
