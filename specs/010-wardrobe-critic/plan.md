# Implementation Plan: Wardrobe Critic — Gap Analysis

**Branch**: `010-wardrobe-critic` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-wardrobe-critic/spec.md`

## Summary

MIEN phân tích tủ đồ như một stylist: tìm khoảng trống cấu trúc, lượng hóa mỗi gợi ý bằng
số outfit MỚI đạt chuẩn mà món giả định mở khóa (mô phỏng bằng chính engine của feed),
trình bày tối đa 3 gợi ý giọng MIEN + phần dư thừa (paid). Kỹ thuật: edge function mới
`wardrobe-critic` import chung `generate-outfits/engine/*` (pattern đã có), mô phỏng
archetype từ catalog tĩnh qua cơ chế synthetic-row → `toFitItem` (tái dùng hạ tầng pin
của 008), server stateless — client cache report + dismissals theo wardrobe hash.

## Technical Context

**Language/Version**: TypeScript (Deno 2.x cho edge function; RN/Expo SDK 54 + TS strict cho client)

**Primary Dependencies**: Supabase (edge functions, Postgres, JWT auth), engine nội bộ `supabase/functions/generate-outfits/engine/*` (enrichment, generation, ranking, scoring), Zustand + MMKV client-side, expo-router

**Storage**: Không có bảng mới. Đọc `clothing_items`, `style_profiles`, `body_measurements`, `profiles` (như generate-outfits). Report + dismissals cache client-side (Zustand persist/MMKV) keyed theo wardrobe hash — server stateless

**Testing**: Deno test cho engine/critic logic (unit + fixture-based); jest cho client store/service; eval-harness fixture tái dùng làm wardrobe mẫu cho test unlock-count

**Target Platform**: iOS + Android (Expo); edge function trên Supabase Deno runtime

**Project Type**: Mobile app + serverless API (cấu trúc hiện có: `app/` + `src/` + `supabase/functions/`)

**Performance Goals**: Báo cáo tính mới ≤ 5s (SC-004); thực tế ~15–20 sim × O(engine-run ~50ms trên tủ ≤80 item) ≪ 5s; mở lại từ cache tức thì

**Constraints**: Server stateless; không LLM cho v1 (note template deterministic vi/en); rate-limit `consume_rate_limit` bucket `wardrobe_critic` (fail-open); offline hiển thị report cache cuối

**Scale/Scope**: Tủ đồ ≤ ~200 item; catalog ~15–20 archetype; 1 edge fn mới + 1 màn hình mới + 1 card feed + 1 store + 1 service

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|---|---|---|
| I. Luxury Minimalist Design | PASS (design-time) | Màn Wardrobe Report + feed card dùng tokens `T.*`, hairline, không gradient/shadow; spec FR-004 giọng MIEN. Chi tiết visual ghi vào `src/design/wardrobe-report/design.md` khi implement |
| II. Thin Screens & Logic Separation | PASS | Toàn bộ logic trong `wardrobeCriticStore` + edge fn; `app/wardrobe-report.tsx` chỉ render |
| III. Service Abstraction Layer | PASS | Client gọi qua `wardrobeCriticService.fetchReport()`; không đụng supabase client trực tiếp từ screen |
| IV. Type Safety & Domain Integrity | PASS | Types chia sẻ trong `src/types/wardrobeCritic.ts` + engine types; TS strict, không `any` |
| V. Dual-Persistence Architecture | PASS | Cache report/dismissals qua Zustand persist (MMKV) — pattern hiện có; không bảng DB mới |
| VI. Feature Self-Containment | PASS | Feature sống trong `src/features/wardrobe-critic/` + fn riêng; chỉ chạm useFitFeed/feed screen ở đúng 1 điểm (end-of-feed card) |

**Post-design re-check (Phase 1)**: PASS — không phát sinh vi phạm; không cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-wardrobe-critic/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── wardrobe-critic.md   # Edge function request/response contract
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
supabase/functions/
├── wardrobe-critic/
│   ├── index.ts             # Edge fn: auth → load → rate-limit → analyze → respond
│   ├── archetypes.ts        # Static archetype catalog (style affinity + synthetic row + note templates vi/en)
│   ├── analyze.ts           # Pure logic: baseline, simulate, unlock-count, redundancy, sparse mode
│   └── analyze.test.ts      # Deno tests (fixture wardrobes)
└── generate-outfits/engine/ # UNCHANGED — imported read-only by analyze.ts

src/
├── types/wardrobeCritic.ts          # GapReport / GapRecommendation / shared response types
├── services/wardrobeCriticService.ts# invoke('wardrobe-critic'), error mapping
├── stores/wardrobeCriticStore.ts    # report cache (wardrobe-hash keyed), dismissals, fetch/refresh
├── stores/__tests__/wardrobeCriticStore.test.ts
├── features/wardrobe-critic/
│   └── components/GapCard.tsx       # 1 gợi ý (archetype, unlock count, note, actions)
└── design/wardrobe-report/design.md # Visual spec

app/
├── wardrobe-report.tsx              # Màn báo cáo đầy đủ (route từ Menu)
└── (tabs)/menu... (+1 mục "WARDROBE REPORT")
app/(tabs)/index.tsx / useFitFeed    # end-of-feed card (1 điểm chạm duy nhất)
```

**Structure Decision**: Mobile + serverless theo layout sẵn có của repo (`app/` route +
`src/features/<feature>/` + `supabase/functions/<fn>/`). Engine được import chéo trong
cùng functions tree — pattern đã dùng (backfill-item-metadata import prompt.ts của
generate-item-image; đã chứng minh deploy bundling hoạt động).

## Complexity Tracking

Không có vi phạm constitution — bảng bỏ trống.

## Changelog

- **2026-07-12** — Outfit-level display tags `ScoredOutfit.silhouette` +
  `ScoredOutfit.colorTone` (engine `types.ts`, assigned in `index.ts`'s
  per-outfit tagging loop alongside `story`/`stylingTips`/`weatherBand`).
  `silhouette` names the target silhouette family (`fitted` / `straight` /
  `relaxed` / `top-volume` / `bottom-volume`) the engine built the outfit
  toward, derived from `ctx.targetSilhouette` via a new
  `outfitSilhouetteTag()` in `engine/silhouette.ts` (falls back to the
  outfit's own realized top/bottom volumes when no target is resolved).
  `colorTone` is the outfit's anchor (dominant) colour, derived via a new
  `outfitDominantColor()` in `engine/scoring.ts` that mirrors the "loudest
  piece leads" ANCHOR rule already used in `generation.ts` (highest
  `statementStrength`, id tie-break, across tops+bottoms+outwear only —
  shoes/accessories excluded). Both fields are **display-only**: they read
  existing engine state and do not feed back into any scoring/ranking
  function or alter `totalScore`/dimension scores. Mirrored on the client in
  `src/types/fitEngine.ts` (`ScoredOutfit`, plus a new mirrored `PrimaryColor`
  type) and surfaced on the Home feed card meta line via
  `useFitFeed.scoredToOutfit` → `src/data/index.ts` `Outfit.silhouette`/
  `Outfit.colorTone` → `app/(tabs)/index.tsx`. See
  `src/design/feed/design.md` for the visual spec.

- **2026-07-12** — Added a parallel display-only field
  `ScoredOutfit.silhouetteShape`, derived 1-to-1 from `silhouette` via a new
  `silhouetteShapeOf()` in `engine/silhouette.ts`: `fitted`→`hourglass`,
  `straight`→`rectangle`, `relaxed`→`oval`, `top-volume`→`inverted-triangle`,
  `bottom-volume`→`triangle`. Assigned in `index.ts`'s per-outfit tagging loop
  right after `o.silhouette`. Both tags are kept — this does not replace or
  alter `silhouette` or any scoring. Mirrored on the client
  (`src/types/fitEngine.ts`, `src/data/index.ts` `Outfit.silhouetteShape`) and
  rendered as an extra chip immediately after the existing silhouette segment
  on the Home feed card meta line (`useFitFeed.scoredToOutfit`,
  `app/(tabs)/index.tsx`), with new i18n keys `outfitShape_hourglass` /
  `_rectangle` / `_oval` / `_invertedTriangle` / `_triangle`. See
  `src/design/feed/design.md` for the visual spec.

- **2026-07-12** — Fixed `outfitSilhouetteTag()` (`engine/silhouette.ts`) to
  classify from the outfit's OWN top/bottom garment volumes only — dropped the
  `target` parameter and the nearest-target-pair branch that used to snap the
  tag back to `ctx.targetSilhouette` (the body_shape/style/intent-derived
  generation target). The tag is a *description* of the finished outfit, so an
  outfit with a regular top + wide bottom must read `bottom-volume`/`triangle`
  regardless of what silhouette the engine was steering generation toward;
  previously it could get mislabelled `straight`/`rectangle` if the target
  happened to be a balanced pair. `index.ts`'s call site updated to
  `outfitSilhouetteTag(its)` (no target arg); `ctx.targetSilhouette` is
  untouched everywhere else (still drives `generateCandidates`/
  `generatePinnedCandidates`/`generateHeroCandidates`). Tests in
  `engine/silhouette.test.ts` updated to the no-target signature.

- **2026-07-12** — Redefined `ScoredOutfit.silhouetteShape` to mean the
  **resulting on-body silhouette**, not a 1-to-1 relabel of `silhouette`.
  Removed `silhouetteShapeOf()`/`SILHOUETTE_SHAPE` (`engine/silhouette.ts`);
  added `resultingBodySilhouette(items, bodyShape?)` in the same file, which
  starts from a `BODY_BASELINE` per `BodyShape` (coarse top/bottom width pair
  on the same 1..5 `VOLUME` scale, plus a waist/rounded flag; a neutral 3/3
  column when `body_shape` is unknown or suppressed under body-neutral mode)
  and shifts it by how much the outfit's garments add over a neutral piece —
  a voluminous top widens the top read, a voluminous bottom widens the bottom
  read, worn outerwear counts toward the top read (max with the top garment).
  `index.ts`'s tagging loop now calls
  `resultingBodySilhouette(its, ctx.bodyMeasurements.body_shape)` in place of
  `silhouetteShapeOf(o.silhouette)`. `silhouette` itself is untouched — still
  the pure garment-volume description of the outfit via `outfitSilhouetteTag`.
  Still **display-only**, no scoring impact. Tests in
  `engine/silhouette.test.ts` replaced accordingly; see
  `src/design/feed/design.md` for the updated visual-spec description.
