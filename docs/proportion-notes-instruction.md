# Instruction: câu giải thích hiệu ứng tỉ lệ cho từng outfit (backlog AL, 2026-11-06)

Mục tiêu: mỗi outfit hiện tối đa 2 câu nói **hiệu ứng tỉ lệ** người dùng nhận được
("Giày cùng tông quần → chân trông dài hơn"). Chỉ để hiển thị, KHÔNG đổi điểm/ranking.

## Quy tắc chung
- KHÔNG đụng scoring/ranking/generation. KHÔNG apply migration, KHÔNG deploy, KHÔNG commit.
- Không dùng `any`. Không magic number — đặt hằng số có tên.
- Chạy `npx tsc --noEmit` + `npx jest` sau khi xong; test engine bằng deno nếu repo có script sẵn (xem cách các `*.test.ts` trong `engine/` đang chạy).
- Cập nhật `src/design/feed/design.md` (UI) và `plan.md` (logic) trong cùng phiên.

## 1. Engine — file mới `supabase/functions/generate-outfits/engine/proportion-notes.ts`
Mô phỏng y hệt `engine/styling-tips.ts`: hàm thuần, deterministic, cả 2 locale inline.

```ts
export interface ProportionNote { key: string; en: string; vi: string }
export function deriveProportionNotes(items: FitItem[], slots?: { top?: string; outwear?: string }): ProportionNote[]
```

Rule theo thứ tự ưu tiên, trả tối đa 2 (`slice(0, MAX_PROPORTION_NOTES)`):

| key | Điều kiện (dùng helper sẵn có, KHÔNG viết lại) | vi | en |
|---|---|---|---|
| `column` | top (category top/onepiece) và bottom cùng `colorProfile.primaryColor` | Áo và quần cùng tông tạo một đường dọc liền → trông cao và gọn hơn | Top and bottom in one tone make an unbroken vertical line — you read taller and leaner |
| `leg_line` | bottom và shoes cùng `primaryColor`, và KHÔNG có `column` | Giày cùng tông quần nối dài đường chân → chân trông dài hơn | Shoes in the same tone as the trousers extend the leg line — legs look longer |
| `open_layer` | có item ở slot outwear (resolve qua `slots.outwear` như styling-tips) và nó khác màu top bên trong | Áo khoác mở tạo hai đường dọc hai bên → thân trông dài và gọn hơn | The open layer frames two vertical lines — the torso looks longer and slimmer |
| `waist` | `outfitWaistDefinition(items)` (silhouette.ts) === true | Eo được nhấn rõ → tỉ lệ trên–dưới cân, dáng trông structure hơn | A defined waist sets the top–bottom proportion — the shape reads more structured |
| `fitted_top_wide_leg` | topVol ≤ 2 và bottomVol ≥ 4 | Áo gọn trên quần ống rộng → phần trên thon, chân trông dài hơn | Fitted top over a wide leg — slimmer up top, longer through the leg |
| `wide_top_slim_leg` | topVol ≥ 4 và bottomVol ≤ 2 | Áo rộng trên quần gọn → vai trông rộng, phần dưới thon hơn | Roomy top over a slim leg — broader shoulders, a leaner lower half |
| `structured_shoulder` | có item outwear `drape === 'structured'` | Vai áo có form → vai thẳng, dáng gọn gàng hơn | A structured shoulder squares the frame — a sharper, straighter line |

- topVol/bottomVol: dùng đúng cách `scoreProportionBalance` (scoring.ts) gom volume (`VOLUME[i.fit]`, max). Nếu cần, export một helper nhỏ từ scoring.ts thay vì copy logic; KHÔNG đổi behavior hàm cũ.
- Đặt ngưỡng (2, 4) thành hằng số có tên.
- Item thiếu field → rule đó không bắn (fail-closed cho hiển thị, không throw).

Test `engine/proportion-notes.test.ts`: mỗi rule 1 case bắn + 1 case không bắn; `column` chặn `leg_line`; tối đa 2; deterministic.

## 2. Engine — gắn vào output
- `engine/types.ts` `ScoredOutfit`: thêm `proportionNotes?: Array<{ key: string; en: string; vi: string }>` cạnh `stylingTips`, kèm comment "display-only, not a scoring input".
- `index.ts` vòng tagging (~dòng 705, cạnh `o.stylingTips = ...`): `o.proportionNotes = deriveProportionNotes(its, { top: o.slots.top, outwear: o.slots.outwear });`

## 3. Client
- `src/types/fitEngine.ts` `ScoredOutfit`: thêm field tương ứng (optional — response cũ/cache không có vẫn chạy).
- `src/data/index.ts` `Outfit`: thêm `proportionNotes?: string[]` (đã resolve locale).
- `src/features/feed/useFitFeed.ts` `scoredToOutfit`: resolve locale giống `stylingTip` (dòng 64–65), map tất cả notes.
- **Thẻ feed** (`src/components/outfit/Collage.tsx`, chỗ render `stylingTip` dòng ~150–167): nếu có `proportionNotes[0]` thì hiện nó THAY CHO `stylingTip` (một dòng, không thêm dòng mới để thẻ không cao lên); không có thì giữ `stylingTip` như cũ.
- **Màn chi tiết outfit** (`app/outfit/[id].tsx`): thêm block nhỏ "Hiệu ứng tỉ lệ" / "Proportion effect" liệt kê tất cả notes (≤2). Không có notes → không render block. Theo style sẵn có của màn đó, không tạo component dùng chung mới nếu chỉ 1 chỗ dùng. Kiểm tra outfit detail lấy dữ liệu outfit từ đâu (store/route param) để notes thực sự tới được màn này; nếu không có đường tới thì báo lại, đừng tự dựng đường mới phức tạp.
- i18n vi + en cho tiêu đề block.

## Báo cáo lại
Danh sách file đổi, kết quả tsc/jest/deno test, và chỗ nào phải đoán.
