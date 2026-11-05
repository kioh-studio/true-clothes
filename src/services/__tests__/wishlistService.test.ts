jest.mock('../supabase', () => ({ sb: {} }));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('../itemPhotoService', () => ({ optimizeImage: jest.fn(), signedUrl: jest.fn() }));
import { wardrobeFingerprint, skippedTotal } from '../wishlistService';

describe('wardrobeFingerprint', () => {
  it('is count:max timestamp, preferring updatedAt', () => {
    expect(wardrobeFingerprint([
      { createdAt: '2026-01-01T00:00:00Z' },
      { createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
    ])).toBe('2:2026-03-01T00:00:00Z');
  });
  it('handles empty wardrobe', () => expect(wardrobeFingerprint([])).toBe('0:'));
  it('changes when an item is added', () => {
    const a = [{ createdAt: '2026-01-01' }];
    expect(wardrobeFingerprint(a)).not.toBe(wardrobeFingerprint([...a, { createdAt: '2026-01-02' }]));
  });
});

describe('skippedTotal', () => {
  it('sums only skipped items with a price', () => {
    expect(skippedTotal([
      { status: 'skipped', price: 100 },
      { status: 'skipped', price: null },
      { status: 'considering', price: 50 },
    ])).toBe(100);
  });
});
