# Quickstart — Wardrobe Critic validation

## Prerequisites

- Deno 2.x, Node + npm, Supabase CLI đã login project `trtjcsxcowqecsebvyme`.
- Một JWT user thật (demo@mien.app) để gọi fn đã deploy.

## 1. Unit/logic (offline, không cần deploy)

```bash
deno test supabase/functions/wardrobe-critic/
```

Kỳ vọng: analyze.test.ts xanh — gồm các invariant của contract (threshold, not-owned,
style affinity, sample ids thật, deterministic per seed) trên fixture wardrobes
(tái dùng `scripts/eval-feed/fixture.ts` + một tủ cố tình khuyết giày formal).

## 2. Client

```bash
npx tsc --noEmit && npx jest src/stores/__tests__/wardrobeCriticStore.test.ts --silent
```

Kỳ vọng: store cache theo wardrobeHash (hash trùng → không refetch), dismiss ẩn đúng
gợi ý, itemCount đổi → dismissals reset.

## 3. End-to-end trên prod fn

```bash
npx supabase functions deploy wardrobe-critic
# rồi (điền JWT):
curl -s -X POST "$SUPABASE_URL/functions/v1/wardrobe-critic" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{}' | jq .
```

Kỳ vọng với tủ demo (~30 món): `mode:"gaps"`, `baseline_qualified > 0`, ≤3 recommendations
có `unlock_count ≥ 3`, mọi invariant trong contract giữ.

## 4. Kiểm SC-002 (lời hứa unlock)

1. Ghi `unlock_count` của gợi ý #1 (vd white_shirt = N).
2. Thêm một item thật khớp archetype vào tủ demo (type SHIRT, color White).
3. Gọi lại fn: `baseline_qualified` tăng ≥ N; gợi ý white_shirt biến mất (đã sở hữu).

## 5. UI flow (device/simulator)

- Menu → WARDROBE REPORT: màn báo cáo render ≤5s lần đầu, tức thì lần hai.
- Free account: thấy gợi ý #1 đầy đủ + 2 hàng khóa; premium: cả 3 + redundancy.
- Cuối feed: card "WARDROBE REPORT" (chỉ khi có gợi ý) → điều hướng đúng.
- GapCard → "Thử khi mua sắm" → mở Try-On; scan món khớp → result có dòng đối chiếu.
