import { wardrobeStats } from '../wardrobeStats';
import type { WardrobeItem } from '../../../types/fitEngine';

const TODAY = '2026-11-06';
// createdAt at local noon so the local date key is unambiguous in any timezone.
const mk = (id: string, createdDay: string, price: number | null = null): WardrobeItem =>
  ({ id, createdAt: new Date(`${createdDay}T12:00:00`).toISOString(), price } as WardrobeItem);

describe('wardrobeStats', () => {
  it('threshold edge: 59 days excluded, 60 included', () => {
    const items = [mk('a', '2026-01-01'), mk('b', '2026-01-01')];
    const wear = {
      a: { count: 1, lastWornOn: '2026-09-08' }, // 59 days
      b: { count: 1, lastWornOn: '2026-09-07' }, // 60 days
    };
    expect(wardrobeStats(items, wear, TODAY).unworn.map(s => s.item.id)).toEqual(['b']);
  });

  it('excludes fresh never-worn, includes old never-worn (14 days)', () => {
    const items = [mk('fresh', '2026-10-24'), mk('old', '2026-10-23')]; // 13 vs 14 days
    const { unworn } = wardrobeStats(items, {}, TODAY);
    expect(unworn.map(s => s.item.id)).toEqual(['old']);
    expect(unworn[0].daysSinceWorn).toBeNull();
  });

  it('cost per wear with 0 wears is the full price', () => {
    const { costPerWear } = wardrobeStats([mk('a', '2026-01-01', 100)], {}, TODAY);
    expect(costPerWear[0].costPerWear).toBe(100);
  });

  it('sorts unworn (never-worn oldest first, then days desc) and cpw desc', () => {
    const items = [
      mk('w70', '2026-01-01', 100), mk('w90', '2026-01-01', 90),
      mk('n2', '2026-09-01'), mk('n1', '2026-08-01'), mk('noprice', '2026-01-01'),
    ];
    const wear = {
      w70: { count: 2, lastWornOn: '2026-08-28' }, // 70 days, cpw 50
      w90: { count: 9, lastWornOn: '2026-08-08' }, // 90 days, cpw 10
      noprice: { count: 1, lastWornOn: '2026-11-05' },
    };
    const r = wardrobeStats(items, wear, TODAY);
    expect(r.unworn.map(s => s.item.id)).toEqual(['n1', 'n2', 'w90', 'w70']);
    expect(r.costPerWear.map(s => s.item.id)).toEqual(['w70', 'w90']);
  });
});
