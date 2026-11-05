jest.mock('../supabase', () => ({ sb: {} }));
import { aggregateWear, itemIdsFromOutfitId } from '../wearService';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('aggregateWear', () => {
  it('counts per item and keeps the latest date', () => {
    expect(aggregateWear([
      { item_id: A, worn_on: '2026-11-01' },
      { item_id: A, worn_on: '2026-11-03' },
      { item_id: B, worn_on: '2026-10-20' },
    ])).toEqual({
      [A]: { count: 2, lastWornOn: '2026-11-03' },
      [B]: { count: 1, lastWornOn: '2026-10-20' },
    });
  });
  it('returns {} for no rows', () => expect(aggregateWear([])).toEqual({}));
});

describe('itemIdsFromOutfitId', () => {
  it('strips gen_ prefix, empty slots and non-uuid demo ids', () => {
    expect(itemIdsFromOutfitId(`gen_${A}|${B}||top-1|`)).toEqual([A, B]);
  });
});
