// Pure stats for the wardrobe-stats screen: "not worn lately" + cost-per-wear.

import type { WardrobeItem } from '../../types/fitEngine';
import type { WearStats } from '../../services/wearService';
import { localDateKey } from '../../utils/localDateKey';

// ponytail: fixed 60-day threshold; make it a setting if users ask
export const UNWORN_DAYS = 60;
// Never-worn items younger than this are not listed (the wear log is new — don't shame a fresh closet).
export const FRESH_DAYS = 14;

export interface ItemStat {
  item: WardrobeItem;
  count: number;
  lastWornOn: string | null;
  daysSinceWorn: number | null;
  costPerWear: number | null;
}

// Both keys are local YYYY-MM-DD, so parsing each at UTC midnight gives an exact whole-day diff.
function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function wardrobeStats(
  items: WardrobeItem[],
  wearStats: WearStats,
  today: string,
): { unworn: ItemStat[]; costPerWear: ItemStat[] } {
  const stats: ItemStat[] = items.map(item => {
    const w = wearStats[item.id];
    const count = w?.count ?? 0;
    return {
      item,
      count,
      lastWornOn: w?.lastWornOn ?? null,
      daysSinceWorn: w ? dayDiff(w.lastWornOn, today) : null,
      costPerWear: item.price != null ? item.price / Math.max(count, 1) : null,
    };
  });

  const addedDay = (s: ItemStat) => localDateKey(new Date(s.item.createdAt));
  const unworn = stats.filter(s =>
    s.daysSinceWorn !== null
      ? s.daysSinceWorn >= UNWORN_DAYS
      : dayDiff(addedDay(s), today) >= FRESH_DAYS,
  );
  unworn.sort((a, b) => {
    if (a.daysSinceWorn === null && b.daysSinceWorn === null) {
      return a.item.createdAt.localeCompare(b.item.createdAt);
    }
    if (a.daysSinceWorn === null) return -1;
    if (b.daysSinceWorn === null) return 1;
    return b.daysSinceWorn - a.daysSinceWorn;
  });

  const costPerWear = stats
    .filter(s => s.costPerWear !== null)
    .sort((a, b) => (b.costPerWear as number) - (a.costPerWear as number));

  return { unworn, costPerWear };
}
