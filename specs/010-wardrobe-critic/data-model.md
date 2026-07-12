# Data Model — Wardrobe Critic (Phase 1)

Không có bảng DB mới. Mọi entity là response/cache shape (TypeScript), chia sẻ giữa
edge fn và client qua `src/types/wardrobeCritic.ts` (client) và types nội bộ fn.

## GapArchetype (static catalog entry — server only)

| Field | Type | Notes |
|---|---|---|
| id | string | ổn định, vd `white_shirt`, `dark_loafers` — dùng làm dismiss key + gap param |
| label | { en, vi } | tên hiển thị, vd "A crisp white shirt" / "Một sơ mi trắng đứng dáng" |
| syntheticRow | ClothingItemRow | row giả cho toFitItem (type, color, material, fit; id = `hypo_<id>`) |
| styleAffinity | string[] | style ids hợp lệ (khớp STYLE_CONFIGS ids) |
| ownedMatch | { type: string; colorFamily: string; formalityBand?: [number, number] } | định nghĩa "đã sở hữu" để loại gợi ý trùng |
| noteTemplate | { en, vi } | giọng MIEN, có placeholder `{count}` |
| starter | boolean | thuộc capsule khởi đầu (sparse mode) |

Validation: id duy nhất; styleAffinity ⊆ STYLE_CONFIGS ids; syntheticRow.type thuộc
controlled TYPES; test cấu trúc trong analyze.test.ts.

## GapRecommendation (response)

| Field | Type | Notes |
|---|---|---|
| archetypeId | string | = GapArchetype.id |
| label | { en, vi } | copy từ catalog |
| unlockCount | number | số outfit đạt chuẩn CHỨA item giả định (D2), ≥ threshold 3 |
| note | { en, vi } | template đã điền `{count}` |
| sampleOutfits | string[][] | ≤ 3 outfit minh họa, mỗi cái là mảng item ids THẬT (không gồm id giả) — client render collage các món sẽ phối cùng |

## RedundancyInsight (response, paid section)

| Field | Type | Notes |
|---|---|---|
| typeName | string | vd `TEE` |
| colorFamily | string | vd `whites` |
| count | number | ≥ 5 |
| note | { en, vi } | giọng nhẹ nhàng |

## WardrobeGapReport (response + client cache)

| Field | Type | Notes |
|---|---|---|
| mode | 'gaps' \| 'starter' \| 'complete' | starter = sparse (FR-008); complete = không gợi ý nào ≥ threshold (US1-AC3) |
| generatedAt | string (ISO) | server time |
| baselineQualified | number | số outfit đạt chuẩn hiện tại (hiển thị context "tủ anh đang tạo được N look") |
| recommendations | GapRecommendation[] | ≤ 3, sort unlockCount desc; rỗng khi mode ≠ 'gaps' |
| starterChecklist | Array<{ archetypeId, label, owned: boolean }> | chỉ khi mode='starter' |
| redundancy | RedundancyInsight \| null | US3; client gate paid |

## Client cache (wardrobeCriticStore, MMKV persist)

| Field | Type | Notes |
|---|---|---|
| report | WardrobeGapReport \| null | bản cuối |
| wardrobeHash | string | digest của sorted `${id}:${updatedAt}`; hash lệch → stale |
| dismissedIds | string[] | archetypeIds bị ẩn; RESET khi số item thay đổi (FR-006) |
| status | 'idle' \| 'loading' \| 'error' | UI state |

State transitions: `fetchReport()` → nếu hash trùng và có report → serve cache; ngược lại
gọi service, cập nhật cả ba field. `dismiss(id)` → thêm vào dismissedIds (report giữ
nguyên; UI lọc). Wardrobe add/delete (itemCount đổi) → clear dismissedIds + refetch nền.
