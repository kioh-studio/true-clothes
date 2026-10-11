# Đề xuất engine — 2026-10-11 (chưa implement, chờ anh Khôi duyệt)

Ba việc trong backlog §AH / §AE / §AG. Mỗi mục: vì sao lần trước hỏng (nếu có), hướng fix
mới, diff ước lượng, và bài test bắt buộc. Tất cả đều trong
`supabase/functions/generate-outfits/engine/`.

---

## 1. `scoreSeasonMatch` mù số lớp — vì sao bản 2026-08-12 bị revert, và hướng khác

### Vì sao bị drop (đọc từ post-mortem `plan.md` ~7615)

Bản cũ làm 2 phần, cả hai sai theo cách khác nhau:

| Phần | Cách làm cũ | Vì sao giết nhầm outfit chuẩn |
|---|---|---|
| A — tổng insulation | Cộng `fabricWeight` (light 1 / medium 2 / heavy 3) của MỌI lớp thân trên, so với ngân sách theo mùa (summer 2, spring 4, fall 5, winter 8) | Áo khoác ngoài bị tính ngang lớp trong → sweater len + coat len = 6 > 5 → outfit mùa thu kinh điển bị kill. Ngân sách summer 2 cũng chặn luôn tee + jacket mỏng. |
| B — base dưới mid+outer | Gate theo ĐỘ DÀI TAY (short sleeve không được nằm dưới cả mid và outer) | Vơ nhầm `TEE` — tee + sweater + jacket là stack chuẩn nhất của menswear. Lỗi thật của polo là CỔ + nẹp khuy lòi ra khỏi cổ tròn, không phải tay. |
| Test | 319 unit test xanh | Test chỉ assert rule mới bắn trúng, không assert outfit chuẩn giữ điểm. |

Xung đột gốc với cách engine đang làm: engine KHÔNG có nhiệt độ Celsius, chỉ có `Season`
5 bucket; và trọng số `season` chỉ 0.05–0.20 nên dimension này không tự đẩy ranking được.
Bản cũ vì thế nhảy sang multiplicative penalty + hard skip — đúng về cơ chế, sai về công thức.

### Hướng khác (đề xuất) — ĐẾM LỚP, không cộng cân nặng

**Nguyên tắc:** áo khoác ngoài là lớp "tháo được", không tính vào độ ấm bắt buộc. Chỉ đếm
lớp thân trên theo `fabric.layerRole` (đã có sẵn: base / mid / outer).

```ts
// scoring.ts — thêm, không sửa scoreSeasonMatch
const SEASON_MAX_INNER_LAYERS: Record<Season, number> = {
  summer: 1, spring: 2, fall: 2, winter: 3, allSeason: 2,   // base + mid, KHÔNG tính outer
};
export function innerLayerCount(items: FitItem[]): number {
  return items.filter(i =>
    (i.category === 'top' || i.category === 'onepiece') &&
    i.fabric.layerRole !== 'outer').length;              // outwear (coat/jacket) miễn
}
export function layerLoadMultiplier(items: FitItem[], target?: Season): number {
  if (!target) return 1;                                   // no-op khi không có mùa
  const over = innerLayerCount(items) - SEASON_MAX_INNER_LAYERS[target];
  if (over <= 0) return 1;
  // 1 lớp dư: phạt mềm; 2 lớp dư: gần kill. CALIBRATION-PENDING.
  return over === 1 ? 0.85 : 0.5;
}
```

Đối chiếu bảng A/B cũ (6 outfit chuẩn):

| outfit | lớp inner | summer | fall | winter |
|---|---|---|---|---|
| tee + jeans | 1 | giữ | giữ | giữ |
| tee + denim jacket | 1 (jacket là outer) | **giữ** (bản cũ 0.873→0.611) | giữ | giữ |
| wool sweater + wool coat | 1 (sweater là mid, coat outer) | ×0.85 — hợp lý: len dày mùa hè | **giữ** (bản cũ kill) | giữ |
| tee + sweater + jacket | 2 | ×0.5 — đúng ý | **giữ** (bản cũ kill) | giữ |
| polo + sweater + overshirt (bug gốc 15–22°C) | 2 | ×0.5 | giữ ở fall → **cần Part B** | giữ |

Nhận xét thẳng: Part A theo cách này KHÔNG tự sửa được ca bug gốc ở mùa thu (2 lớp inner
là hợp lệ mùa thu). Ca đó là lỗi của Part B (polo), không phải lỗi độ ấm. Vậy nên:

**Part B — chỉ POLO.** Rule: `slots.mid && slots.outwear && base.typeName === 'POLO'` →
skip ở choke point `ranking.ts:~450` (cùng chỗ rule mid-nặng) và ở 2 builder mid trong
`generation.ts`. KHÔNG gate SHIRT: sơ mi + sweater + blazer là stack preppy chuẩn, cổ sơ
mi lòi ra khỏi cổ tròn là CỐ Ý. Không cần attribute mới, không cần cột DB.

**Tuỳ chọn thêm (nhẹ):** sửa `targetMatch` trong `scoreSeasonMatch` từ trung bình sang
`0.5 * avg + 0.5 * min` để một món lệch mùa hẳn (coat len giữa mùa hè, compat 0.0) kéo
điểm xuống thay vì bị 3 món allSeason pha loãng. Không ảnh hưởng số lớp, chỉ sửa đúng
"trung bình che lỗi". Fall + coat winter = 0.8 nên không hại outfit thu.

**Wire:** nhân `layerLoadMultiplier` vào `totalScore` tại `ranking.ts` cạnh `taste.multiplier`
(cùng pattern). Không hard-skip ở Part A — để A/B quyết.

### Test bắt buộc trước deploy (bài học #3)

Thêm `canonical-outfits.test.ts`: fixture 6 outfit trên × 3 mùa, assert
`|scoreAfter − scoreBefore| ≤ 0.02` cho mọi ô "giữ" trong bảng, và `scoreAfter < scoreBefore`
cho các ô phạt. Snapshot điểm baseline lấy từ engine HIỆN TẠI trước khi apply patch. Chạy
`scripts/eval-feed` A/B trên 5 fixture; top-10 turnover > 30% ở fixture không liên quan
(minimalist/smartcasual) = dừng.

**Diff ước lượng:** ~40 dòng scoring.ts + ~10 ranking.ts + ~6 generation.ts + 1 file test.

### Review lại số liệu (lượt 2, cùng ngày) — bảng ở trên BỊ THAY bằng 1 rule

Đọc lại `generation.ts` (variantsFor, ~535–600): một outfit chỉ có 3 chỗ cho thân trên —
`top`, `outwear`, và `mid` (mid chỉ xuất hiện cùng một outer THẬT). Số lớp inner
(base/mid, không tính outer) vì thế **tối đa = 2** ở mọi nhánh sinh. Hệ quả:

| Hàng trong bảng | Ngưỡng | Có bao giờ vượt? |
|---|---|---|
| summer | 1 | có (2 lớp) → chỉ nhánh ×0.85 chạy |
| spring / fall / allSeason | 2 | **không bao giờ** |
| winter | 3 | **không bao giờ** |

→ 4/5 hàng chết, hệ số 0.5 (dư 2 lớp) **không với tới được**. Bảng gọn lại thành đúng
một câu: *mùa hè mà 2 lớp inner → ×0.85*.

Hai điều nữa lộ ra khi soát:
1. Hàm `innerLayerCount` bản nháp lọc `category top|onepiece` → bỏ sót HOODIE/KIMONO
   (layerRole `mid` nhưng category `outwear`). Phải đếm theo `layerRole !== 'outer'` trên
   cả `top|onepiece|outwear`.
2. Rule mùa hè đánh đồng *tee + sơ mi linen mở khuy* (hợp lệ) với *tee + sweater medium*
   (sai). Phân biệt được bằng dữ liệu có sẵn: `fabricWeight` của lớp thứ hai
   (`warmth_season = lightweight_summer` → `light`). Gốc sâu hơn: `WARMTH_SEASON_MAP` chỉ có
   3 bucket thật (summer / allSeason / winter) — sweater medium bị gắn `allSeason`, nên
   `scoreSeasonMatch` nhìn thấy compat 0.9, không có tín hiệu gì. Trộn `min` vào
   `targetMatch` cũng không cứu được ca này (min vẫn 0.9). Sửa vocab ở extraction/backfill là
   việc riêng, để backlog.

**Rule chốt đề xuất (thay toàn bộ Part A cũ):**

```ts
// Chỉ phạt khi target là summer, có đúng 2 lớp inner, và lớp nặng hơn không phải 'light'.
export function summerStackMultiplier(items: FitItem[], target?: Season): number {
  if (target !== 'summer') return 1;
  const inner = items.filter(i =>
    (i.category === 'top' || i.category === 'onepiece' || i.category === 'outwear') &&
    i.fabric.layerRole !== 'outer');
  if (inner.length < 2) return 1;
  if (inner.every(i => i.fabric.fabricWeight === 'light')) return 1;   // linen shirt mở khuy
  return 0.85;   // CALIBRATION-PENDING
}
```

Vì sao 0.85 đủ và không cần số thứ hai: totalScore điển hình 0.55–0.80 → trừ 0.08–0.12,
đúng bằng xoá sạch dimension season (`W_SEASON` 0.10). Tức là nó làm việc mà
`scoreSeasonMatch` đáng lẽ phải làm nếu vocab mùa không bị gộp. Không hard-skip.
Part B (gate POLO dưới mid+outer) giữ nguyên như trên.

---

## 2. Onepiece chỉ sinh được qua 2/10 formula — cách fix

### Hiện trạng
`categorize()` xếp dress/jumpsuit vào `cats.onepiece`; 10 pool generator chỉ đọc
`cats.top`/`cats.bottom`. `generateOnepieceCandidates` hardcode 2 formula, dùng slot
`{ top: op.id, bottom: op.id }` — tức là **engine đã chấp nhận một món chiếm cả 2 slot**.
`passesHardConstraints` và dedup key `top|bottom|shoe|outwear` đều không phản đối id trùng.

### Fix lazy — onepiece là "top tự ghép đôi với chính nó"

1. `categorize()` giữ nguyên bucket, nhưng `getFormulaPools` gọi generator với
   `cats.top = [...cats.top, ...cats.onepiece]`. Mọi predicate statement/neutral/tonal/
   texture/pattern của 10 formula tự nhiên áp lên váy — không viết path riêng.
2. `generateFromPool`:
   - Nhánh anchor thường: nếu `anchor.category === 'onepiece'` → `looks.push({ top: anchor,
     bottom: anchor, shoe })` cho BRANCH đôi giày tốt nhất; bỏ bước tìm counterpart.
   - Khi anchor là top/bottom bình thường: `counterpartPool` lọc bỏ onepiece (váy không
     ghép với quần).
   - Nhánh anchor outwear: với mỗi `top` là onepiece → `bottom = top`, không tra `pool.bottoms`.
   - `layerables`/`midOptions` không bị ảnh hưởng (DRESS không có `layerRole: 'mid'`, cần
     verify `canLayer` của DRESS trong enrichment — nếu `true` thì lọc `category !== 'onepiece'`).
3. Xoá `generateOnepieceCandidates` (dedup sẽ gộp trùng nếu giữ; nhưng giữ thì RNG draw
   đổi thứ tự snapshot — xoá sạch cho rõ). Fixture hiện không có onepiece → snapshot không
   đổi; thêm fixture `womenswear` có 2 váy để chốt hành vi mới.

Cái phải quyết (sản phẩm): formula nào KHÔNG hợp với 1 món liền thân? Em thấy chỉ
`rule_of_thirds` (chia tỉ lệ top/bottom) và `high_low` (mix register 2 món) là gượng —
đề xuất cho onepiece đi qua 8 formula, loại 2 formula này bằng 1 dòng
`if (pool.formula === 'rule_of_thirds' || pool.formula === 'high_low') skip onepiece anchors`.

**Diff ước lượng:** ~25 dòng generation.ts, −60 dòng (xoá generator cũ), +1 fixture.
Rủi ro: `pairAffinity(op, shoe)` đã chạy được vì onepiece vốn ở slot top. Scoring
(`scoreProportionBalance` etc.) đã handle `category === 'onepiece'` ở cả tops và bottoms.

---

## 3. Volume-on-volume xoá eo — chưa có ở `scoring.ts`

### Cái đã có (đừng làm trùng)
- `passesHardConstraints` (ranking.ts:196): oversized top + oversized bottom → loại hẳn.
- `scoreProportionBalance`: vol ≥4 + ≥4 → 0.35; ≥5 + ≥5 → 0.15. Nhưng trọng số
  `proportion` 0.10 → tối đa kéo totalScore xuống ~0.065. Quá nhẹ, và chỉ nhìn `fit`
  (volume), KHÔNG nhìn `drape`.
- Curator LLM (`curator.ts:165`) có câu phạt fluid+fluid — best-effort, tắt khi không có key.

Ca bug gốc: cardigan oversized (vol 5, nhưng là `top`, không phải `outwear` → vẫn lọt
hard constraint? — KHÔNG: dòng 194 gom cả `top` và `outwear`, nên oversized+oversized đã bị
loại. Vậy ca thật là cardigan oversized (5) + quần ống rộng `wide` (4): proportion 0.35,
không hard-fail) trên hourglass, card vẫn khoe "SHAPE: HOURGLASS".

### Fix đề xuất — 1 hàm, multiplicative, đọc cả `fit` và `drape`

```ts
// scoring.ts
const WAIST_DEFINING = new Set(['CORSET', 'BLAZER', 'VEST', 'BELT']);   // reuse WAIST_DEFINING_TYPES nếu đã export
export function waistErasureMultiplier(items: FitItem[], shape?: BodyShape): number {
  const tops = items.filter(i => i.category === 'top' || i.category === 'onepiece');
  const bottoms = items.filter(i => i.category === 'bottom');
  if (!tops.length || !bottoms.length) return 1;
  const topVol = Math.max(...tops.map(i => VOLUME[i.fit]));
  const botVol = Math.max(...bottoms.map(i => VOLUME[i.fit]));
  const bothFluid = tops.some(i => i.drape === 'fluid') && bottoms.some(i => i.drape === 'fluid');
  const bothBig = topVol >= 4 && botVol >= 4;
  if (!bothBig && !bothFluid) return 1;
  if (items.some(i => WAIST_DEFINING.has(i.typeName))) return 1;   // belt/blazer cứu eo
  // Người có eo (hourglass) mất nhiều nhất; rectangle/apple vốn không dựa vào eo.
  const base = shape === 'hourglass' ? 0.75 : shape === 'triangle' || shape === 'inverted_triangle' ? 0.85 : 0.92;
  return bothBig && bothFluid ? base - 0.1 : base;          // CALIBRATION-PENDING
}
```

Wire vào `totalScore` ở `ranking.ts` cạnh `taste.multiplier`. Chỉ outer `top`/`onepiece`,
KHÔNG tính `outwear` (coat rộng khoác ngoài là bình thường — cùng bài học với mục 1).
`drape` undefined → `bothFluid` false → fail-open.

Đồng thời gắn nhãn: khi multiplier < 1 thì `describe-outfit`/card KHÔNG nên hiện
"SHAPE: HOURGLASS" như lời khen — nhưng đó là UI, tách việc.

**Test:** cardigan oversized + wide pants trên hourglass → ×0.75; cùng outfit + belt → ×1;
tee slim + wide pants → ×1; fixture `resort` (toàn fluid) phải không tụt top-10 quá 2 slot.

**Diff ước lượng:** ~25 dòng scoring.ts + 3 dòng ranking.ts + test.

---

## Ghi chú thứ tự làm
1 (Part B polo + canonical test) → 3 → 2. Mục 1-Part A và mục 3 đều là multiplicative
trên totalScore, nên A/B chung một lượt `scripts/eval-feed` là đủ.
