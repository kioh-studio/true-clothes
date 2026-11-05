# Instruction — Wardrobe stats: "lâu chưa mặc" + cost-per-wear (2026-11-06)

Approved by anh Khôi 2026-11-06 (backlog AK item "Lâu chưa mặc + cost-per-wear"). Executor: Sonnet.
Builds on the per-item wear log already committed (`wear_events`, `src/services/wearService.ts`,
`appStore.wearStats` = `Record<itemId, { count, lastWornOn }>`).

## Global rules
- Supabase project is PAUSED: write the migration FILE only, do NOT apply/deploy. Do NOT commit.
- Do NOT touch engine ranking/scoring. No new dependencies. No `any`.
- All new strings in vi + en (`src/i18n/locales`). Follow `src/design/tokens.ts` + CLAUDE.md
  luxury-minimal rules (hairline, no shadows). Screens thin; logic in hooks/pure functions;
  Supabase only via `src/services/*`. Dates via `src/utils/localDateKey.ts`, never `toISOString()` for day keys.
- Run `npx tsc --noEmit` and `npx jest` at the end; both must be clean.
- Docs same session: `plan.md` (dated entry at top), `src/design/wardrobe/design.md`.
  In `backlog.md` DELETE the line "**\"Lâu chưa mặc\" + cost-per-wear**" (it is done).

## 1. Price on wardrobe items
Migration `supabase/migrations/20261106000001_clothing_items_price.sql`:
```sql
alter table public.clothing_items
  add column if not exists price numeric(12,2) check (price is null or price >= 0);
```
(Existing RLS covers it; no new policy.)
- `WardrobeItem` (`src/types/fitEngine.ts`): add optional `price?: number | null`.
- `src/services/wardrobeService.ts`: include `price` in the select + row→item mapping
  (numeric arrives as string from PostgREST → `Number()`, null stays null); add
  `setItemPrice(itemId, price: number | null)`. Reuse `parsePrice` from `wishlistService.ts`
  for input parsing (move it to a shared util only if importing it would create a cycle).
- Edge functions do NOT need price. Do not touch them.

## 2. Pure stats function — `src/features/wardrobe/wardrobeStats.ts`
```ts
export interface ItemStat { item: WardrobeItem; count: number; lastWornOn: string | null;
  daysSinceWorn: number | null; costPerWear: number | null }
export function wardrobeStats(items, wearStats, today: string /* YYYY-MM-DD */): {
  unworn: ItemStat[];   // see rule below, sorted: never-worn first (oldest createdAt first), then daysSinceWorn desc
  costPerWear: ItemStat[]; // items with price != null, sorted by costPerWear desc
}
```
- `UNWORN_DAYS = 60`. An item is "unworn" when: worn before and `daysSinceWorn >= 60`, OR never worn
  and it was added ≥ 14 days ago (createdAt local date). Newly added never-worn items are NOT listed
  (wear log only started recently — don't shame a fresh closet).
  `// ponytail: fixed 60-day threshold; make it a setting if users ask`.
- `costPerWear = price / max(count, 1)` (never-worn = full price). Round only at display.
- Day diff: compute from YYYY-MM-DD strings (UTC-midnight parse of both keys is fine since both are
  local date keys). One test file `__tests__/wardrobeStats.test.ts` covering: threshold edge (59 vs 60),
  fresh never-worn excluded, old never-worn included, CPW with 0 wears, sorting.

## 3. UI
- `app/item/[id].tsx`: in the existing wear row area add a quiet optional price field
  ("Giá mua" / "Price paid"), saved on blur via `setItemPrice` (optimistic update in the store that
  holds wardrobe items). When price set, show "≈ {cpw} / lần mặc" / "≈ {cpw} per wear" next to the
  "Đã mặc N lần" line. Format money with the same formatter the wishlist footer uses.
- New screen `app/wardrobe-stats.tsx` (+ `src/features/wardrobe/useWardrobeStats.ts` hook that reads
  wardrobe items + `wearStats` from the stores and calls `wardrobeStats(…, localDateKey())`):
  - Section "Lâu chưa mặc" / "Not worn lately": rows = thumbnail + name + "{n} ngày" or "Chưa mặc lần nào".
    Tap → `/item/[id]`. Empty state one line: "Tủ đồ của bạn đang được dùng đều." / "Everything's in rotation."
  - Section "Giá mỗi lần mặc" / "Cost per wear": rows = thumbnail + name + cpw + "{count} lần".
    If no item has a price: one line hint "Nhập giá ở trang chi tiết món đồ để xem." / "Add a price on an item to see this."
  - Register the route in `app/_layout.tsx` like `wishlist`.
- Entry: Home menu sheet in `app/(tabs)/index.tsx`, next to the wishlist row (~line 582), hairline icon
  from `src/components/icons` (pick an existing one; don't draw a new icon).

## Report back
Files changed, test counts before/after, anything unclear you stopped on, and the migration to apply.
