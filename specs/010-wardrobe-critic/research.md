# Research — Wardrobe Critic (Phase 0)

Không còn NEEDS CLARIFICATION trong spec (2 điểm mở đã được anh Khôi chốt trong spec).
Phần này ghi lại các quyết định kỹ thuật và lý do.

## D1 — Mô phỏng unlock-count bằng engine thật, chạy trong MỘT edge function

- **Decision**: Edge fn mới `wardrobe-critic` import trực tiếp `generate-outfits/engine/*`
  và chạy pipeline (enrich → style filter → generateCandidates → rankCandidates → quality
  gate) N+1 lần trong một request: 1 baseline + 1 lần/archetype ứng viên.
- **Rationale**: SC-002 đòi unlock-count là lời hứa THẬT theo đúng chuẩn feed — cách duy
  nhất bảo đảm là dùng chính code đó (không heuristic xấp xỉ). Engine thuần CPU, một lượt
  trên tủ ≤80 item mất ~vài chục ms trong Deno → 20 sim ≪ 5s (SC-004). Import chéo trong
  functions tree đã được chứng minh (backfill ← generate-item-image/prompt.ts).
- **Alternatives considered**: (a) gọi HTTP sang generate-outfits per archetype — chậm
  (N round-trip), tốn invocation, và generate-outfits trả top-10 chứ không trả count;
  (b) heuristic tĩnh "slot nào trống" — không giữ được SC-002; (c) client-side simulation —
  engine là Deno code server, port sang RN là fork nguy hiểm.

## D2 — Định nghĩa "unlock count"

- **Decision**: Số outfit ĐẠT CHUẨN (qua đúng quality gate của feed: MIN_QUALITY 0.50 +
  band 0.18) trong ranked set mà **chứa item giả định**, sau khi chèn nó vào tủ. Không
  dùng delta tổng (tổng bị nhiễu bởi diversification/cap khi tủ lớn); một outfit chứa
  món mới và đạt chuẩn = một combo thật sự "mới nhờ nó".
- **Rationale**: Ổn định, giải thích được cho user ("12 outfit dùng món này"), và kiểm
  chứng được đúng SC-002 (thêm món thật → các outfit đó xuất hiện).
- **Alternatives**: delta tổng qualified (nhiễu), đếm cả candidate không qua gate (vi phạm
  "đạt chuẩn trên feed").

## D3 — Catalog archetype tĩnh + note template, KHÔNG LLM cho v1

- **Decision**: ~15–20 archetype nền tảng hard-code trong `archetypes.ts`: mỗi cái có
  (a) synthetic ClothingItemRow (type/color/material/fit — đủ để toFitItem enrich như item
  thật), (b) styleAffinity (danh sách style id hợp lệ), (c) ownedMatcher (type + họ màu
  + dải formality để loại trùng với đồ đang có), (d) note template vi/en giọng MIEN.
- **Rationale**: Deterministic, test được, không tốn Gemini, đúng assumption trong spec
  ("bộ archetype tuyển chọn hữu hạn"). Free tier hưởng nguyên chức năng.
- **Alternatives**: LLM sinh gợi ý (không kiểm soát được lời hứa unlock-count, tốn tiền,
  chậm); bảng DB (thêm vận hành, chưa cần khi catalog thay đổi theo release).

## D4 — Redundancy clustering

- **Decision**: Cluster theo (typeName, colorFamily — dùng getColorFamily của engine,
  băng formality ±0.75). Cụm ≥ 5 món → 1 mục dư thừa (tối đa 1 mục/report, cụm lớn nhất).
- **Rationale**: Đơn giản, giải thích được; ngưỡng 5 khớp acceptance của US3.

## D5 — Sparse mode

- **Decision**: < 10 item HOẶC thiếu slot lõi (top/bottom/shoes sau style filter) →
  trả `mode: 'starter'` với capsule checklist tĩnh theo style chính (từ archetypes.ts,
  cờ `starter: true`), không có unlock-count.
- **Rationale**: Unlock-simulation vô nghĩa khi baseline = 0; khớp FR-008/edge cases.

## D6 — Server stateless; cache + dismissals ở client

- **Decision**: Không bảng mới. `wardrobeCriticStore` (Zustand persist/MMKV) giữ
  `{ report, wardrobeHash, dismissedIds }`; hash = sorted item ids+updatedAt digest.
  Wardrobe đổi → hash đổi → refetch; dismissals reset khi có item thêm/xóa (FR-006).
- **Rationale**: Khớp dual-persistence hiện có; tránh migration + RLS mới; offline = đọc
  cache cuối (edge case). Trade-off chấp nhận: dismissals không sync giữa 2 thiết bị (hiếm).

## D7 — Gating & rate-limit

- **Decision**: Fn luôn trả đủ 3 gợi ý + redundancy; client gate hiển thị theo
  `usePremium` (free: gợi ý #1 + hàng khóa mờ cho #2/#3 — teaser đúng FR-010). Server
  rate-limit `consume_rate_limit(bucket 'wardrobe_critic', 10/giờ)`, fail-open, 429 khi hết.
- **Rationale**: Gating hiển thị là pattern hiện có (curator paid); fn không cần biết tier.
  Free thấy #1 đầy đủ nên server trả full là chấp nhận được (không phải secret paid-only
  data; nếu sau này cần chặt hơn thì thêm profiles check ở fn).

## D8 — Try-On bridge (US2)

- **Decision**: `app/wardrobe-report.tsx` → nút trên GapCard điều hướng `/try-on` kèm
  param `gapArchetypeId`; tryOnStore giữ `pendingGapId`; ResultScreen khi verdict xong
  so `type + colorFamily` của item scan với archetype → hiện 1 dòng "khớp khoảng trống X"
  + unlock-count THẬT của chính món scan (đã có sẵn từ Mix&Match count? — v1: hiện label
  khớp; đếm unlock thật của món scan là extension, ghi tasks P2 optional).
- **Rationale**: Chạm tối thiểu vào 008; phần "đối chiếu" acceptance 2 của US2 được đáp
  ứng ở mức label; unlock-count per scanned item có thể tái dùng wardrobe-critic fn với
  `candidate_item` override (contract đã chừa chỗ).
