# Tasks: Wardrobe Critic — Gap Analysis

**Input**: Design documents from `/specs/010-wardrobe-critic/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wardrobe-critic.md

**Organization**: Grouped by user story; US1 alone is a shippable MVP.

## Phase 1: Setup

- [x] T001 Tạo skeleton `supabase/functions/wardrobe-critic/` (index.ts, archetypes.ts, analyze.ts, analyze.test.ts)
- [x] T002 [P] Tạo `src/types/wardrobeCritic.ts` theo data-model.md (GapReport/GapRecommendation/RedundancyInsight, snake→camel mapping types)

## Phase 2: Foundational (US1 core logic — server)

- [x] T010 `archetypes.ts`: catalog ~16 archetype (label vi/en, syntheticRow, styleAffinity, ownedMatch, noteTemplate vi/en, starter flag) + capsule starter set
- [x] T011 `analyze.ts`: pipeline thuần — enrich (toFitItem) → style filter → baseline qualified count (generateCandidates+rankCandidates+quality gate, seed userId+date) → per-archetype simulate (inject synthetic row, unlock = qualified outfits CHỨA item giả) → top 3 ≥ threshold 3 → sampleOutfits (ids thật) → redundancy cluster (type+colorFamily+formality band, ≥5) → sparse mode (<10 item hoặc thiếu slot lõi → starter checklist với owned flags) → 'complete' khi không gợi ý nào đạt
- [x] T012 `analyze.test.ts`: fixture tủ khuyết giày formal → gap loafers unlock ≥3; invariants contract (không owned-dup, style affinity, sample ids thật, không id `hypo_*`, deterministic cùng seed); sparse fixture → starter; tủ tròn → complete
- [x] T013 `index.ts`: auth JWT → rate-limit `wardrobe_critic` 10/3600s (fail-open, 429) → load wardrobe/style/body/profile (mirror generate-outfits) → analyze → response theo contract (snake_case) + CORS; optional `candidate_item` → `candidate.unlockCount` + matchedArchetypeId
- [x] T014 Deno test + `deno check` xanh; deploy `wardrobe-critic` (verify_jwt mặc định); smoke bằng curl JWT demo theo quickstart §3

## Phase 3: US1 — client report (MVP)

- [x] T020 [P] `src/services/wardrobeCriticService.ts`: invoke fn, map snake→camel, lỗi 429/network → typed error
- [x] T021 `src/stores/wardrobeCriticStore.ts` (persist MMKV): report/wardrobeHash/dismissedIds/status; fetchReport() cache theo hash; dismiss(id); reset dismissals khi itemCount đổi; jest test `src/stores/__tests__/wardrobeCriticStore.test.ts`
- [x] T022 `src/features/wardrobe-critic/components/GapCard.tsx`: label, unlock count ("MỞ KHÓA 12 LOOK"), note theo locale, sample collage nhỏ (ảnh các item thật sẽ phối cùng), actions (Try-On bridge, dismiss) — tokens T.*, hairline
- [x] T023 `app/wardrobe-report.tsx`: màn đầy đủ — header MIEN, context "tủ anh đang tạo được N look", list GapCard, redundancy section, starter mode UI, complete mode UI; free gating qua usePremium (gợi ý #1 đầy đủ + hàng khóa #2/#3 + redundancy khóa)
- [x] T024 Mục "WARDROBE REPORT" trong tab Menu (`app/(tabs)/menu` route hiện có) điều hướng tới màn báo cáo
- [x] T025 [P] `src/design/wardrobe-report/design.md`: visual spec theo constitution I

## Phase 4: US2 — Try-On bridge + feed card

- [x] T030 Card cuối feed (1 điểm chạm duy nhất trong feed screen/useFitFeed): hiện khi store có ≥1 gợi ý chưa dismiss → điều hướng wardrobe-report
- [x] T031 GapCard action → `/try-on` với param `gapArchetypeId`; tryOnStore giữ `pendingGapId`; Try-On result: nếu item scan khớp ownedMatch của archetype → dòng "khớp khoảng trống: {label}" (label từ store)
- [ ] T032 (BACKLOG) (optional P2 extension) result gọi fn với `candidate_item` để hiện unlock-count thật của món vừa scan

## Phase 5: US3 — redundancy (paid)

- [x] T040 Redundancy section trong wardrobe-report (đã render ở T023; task này verify data path + paid gate + copy giọng nhẹ nhàng)

## Phase 6: Polish & docs

- [x] T050 `npx tsc --noEmit` + `npx jest --silent` + `deno test` toàn bộ xanh
- [x] T051 plan.md (root) changelog + backlog.md cập nhật; quickstart §4 SC-002 kiểm tay trên tủ demo
