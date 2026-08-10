# Feed signals — `viewed` + swipe-left `dismissed` (thay thế phương án dwell)

Date: 2026-08-07. Approved by anh Khôi. Executor: Sonnet 5.
Context: taste vector (`generate-outfits/engine/taste.ts`) tồn tại nhưng đói dữ
liệu (prod: 1016 impressions / 0 saves). Hai tín hiệu mới: `viewed` (tap mở
outfit detail — positive nhẹ) và `dismissed` (swipe trái trên feed card —
negative tường minh). Dwell-time ĐÃ BỊ LOẠI (card tĩnh, phân phối nén — anh
Khôi chỉ ra đúng).

DB ĐÃ SẴN SÀNG: constraint live `outfit_interactions_type_check` đã được ALTER
(2026-08-07, qua Management API) thành
`type in ('saved','worn','scheduled','impression','viewed','dismissed')`.
Bảng có sẵn UNIQUE(user_id, outfit_id, type) — dùng nó để dedupe.

Do NOT edit backlog.md/plan.md. Do NOT deploy. Do NOT commit.

## 1. Migration file (đồng bộ với live — KHÔNG chạy)

Tạo `supabase/migrations/20260807000001_outfit_interactions_viewed_dismissed.sql`
với đúng ALTER đã áp lên live:

```sql
alter table public.outfit_interactions drop constraint outfit_interactions_type_check;
alter table public.outfit_interactions add constraint outfit_interactions_type_check
  check (type = any (array['saved'::text,'worn'::text,'scheduled'::text,
                           'impression'::text,'viewed'::text,'dismissed'::text]));
```

Kèm comment đầu file: "Applied to live 2026-08-07 via Management API — file này
chỉ để đồng bộ lịch sử migration (schema drift đã biết). LƯU Ý migration gốc
20260608000006 cũng thiếu 'impression' so với live."

## 2. Client — `viewed` event

- Đọc `src/services/outfitInteractionService.ts` để theo pattern record hiện có
  (impression dùng gì thì viewed dùng nấy: cùng shape `outfit_data`
  {formula, position, curated}).
- Fire tại điểm điều hướng feed → outfit detail (tìm onPress của feed card trong
  `app/(tabs)/index.tsx` / `src/features/feed/`): record type `'viewed'`,
  fire-and-forget, nuốt lỗi (kể cả lỗi unique-conflict khi xem lại lần 2 —
  dùng upsert ignoreDuplicates hoặc catch im lặng).
- KHÔNG record khi mở outfit detail từ nguồn khác feed (saved list, builder).

## 3. Client — swipe trái `dismissed`

- Khảo sát gesture hiện có trên feed card trước (CLAUDE.md nói swipe phải =
  save — kiểm tra thực tế trong code; nếu chỉ có long-press thì vẫn thêm swipe
  trái, dùng react-native-gesture-handler đã có trong repo, `activeOffsetX`
  âm + `failOffsetY` để không tranh chấp scroll dọc của FlatList pager).
- Hành vi khi swipe trái vượt ngưỡng (~35% bề ngang):
  1. Card mờ đi (opacity ~0.35, transition chậm theo design) + overlay label
     hairline giữa card: en `NOT MY STYLE` / vi `KHÔNG HỢP GU` (i18n).
  2. Record `dismissed` (cùng service, cùng outfit_data shape).
  3. Sau ~400ms tự cuộn sang outfit kế (FlatList scrollToIndex).
  4. KHÔNG có undo trong v1.
- First-time hint: lần đầu user vào feed sau update, hiện 1 dòng caption nhỏ
  (vị trí theo design tokens, không popup): en `Swipe left — not your style.
  Swipe right — save.` / vi `Vuốt trái — không hợp gu. Vuốt phải — lưu lại.`
  (điều chỉnh vế sau theo gesture save thực tế). Persist cờ đã-hiện
  (AsyncStorage/MMKV theo pattern app đang dùng).
- `src/stores/fitEngineStore.ts`: thêm `dismissedOutfitIds: string[]` persist
  (Zustand persist như shownOutfitIds), cap 200 id gần nhất; merge vào
  `exclude_ids` gửi server và KHÔNG bị flush khi hết cycle (khác shownOutfitIds).

## 4. Server — taste.ts tiêu thụ 2 tín hiệu

`supabase/functions/generate-outfits/`:
- `index.ts`: query interactions mở rộng — positives thêm `viewed`, và query
  riêng `dismissed` (limit 300 như các loại khác). Đưa vào `buildTasteVector`.
- `engine/taste.ts` (đây là phần cần cẩn thận nhất — đọc kỹ file trước):
  - Positives: trọng số `viewed = 0.5`, `saved = 1`, `worn = 2` (hằng số đặt
    tên, comment CALIBRATION-PENDING). Confidence hiện `min(1, saves/8)` →
    đổi thành weighted count: `min(1, (0.5·viewed + saves + 2·worn)/8)`.
  - Negatives: build vector thứ hai từ outfits `dismissed` (cùng 4 đặc trưng
    formality/statement/contrast/colour). Penalty = `dismissConfidence ×
    affinityToDismissedVector × TASTE_MAX_PENALTY`, với
    `TASTE_MAX_PENALTY = 0.04` và `dismissConfidence = min(1, dismissals/8)`.
    Tổng taste delta bounded trong [−0.04, +0.06] — bonus dương giữ nguyên
    cơ chế cũ, KHÔNG đổi TASTE_MAX_BONUS/LIFT hiện có.
  - Exposure baseline (impressions) giữ nguyên.
- Deno tests mới: (a) viewed đóng góp positive nhưng yếu hơn saved cùng số
  lượng; (b) outfit giống hồ sơ dismissed bị trừ điểm, outfit khác không bị;
  (c) tổng delta không vượt [−0.04, +0.06]; (d) 0 viewed/dismissed → hành vi
  y hệt hôm nay (regression).

## 5. Verification

- `deno test` 3 function dirs xanh; `npx tsc --noEmit` xanh; `npx jest` xanh.
- i18n: keys mới ở CẢ en.json + vi.json.
- Report: file:line từng thay đổi, gesture infra tìm thấy là gì, test tails,
  việc gì deferred.
