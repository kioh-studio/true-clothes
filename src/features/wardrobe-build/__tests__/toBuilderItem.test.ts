// Unit tests for the WardrobeItem → BuilderItem adapter used by the manual
// outfit builder (app/build.tsx).

import type { WardrobeItem } from '../../../types/fitEngine';
import {
  toBuilderItem, builderTypeOf, builderNameOf, builderColorOf, assignBucketKey,
} from '../toBuilderItem';

function makeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    photoStorage: 'cloud',
    photoUrl: null,
    photoLocalUri: null,
    photoPath: 'user-1/item-1.jpg',
    category: 'top',
    type: 'SWEATER',
    colors: ['forest green'],
    sizeLabel: null,
    brand: 'Uniqlo',
    notes: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    name: 'Forest green sweater',
    primaryColor: 'green',
    material: null,
    fit: null,
    pattern: null,
    warmthSeason: [],
    measurements: null,
    graphics: null,
    canLayer: null,
    primaryHex: null,
    secondaryHex: null,
    distressed: null,
    ...overrides,
  };
}

describe('builderTypeOf', () => {
  it('uses the explicit type when set', () => {
    expect(builderTypeOf('sweater', 'top')).toBe('SWEATER');
  });

  it('falls back to the category→type map when type is null', () => {
    expect(builderTypeOf(null, 'top')).toBe('TEE');
    expect(builderTypeOf(null, 'bottom')).toBe('JEANS');
    expect(builderTypeOf(null, 'outerwear')).toBe('JACKET');
    expect(builderTypeOf(null, 'footwear')).toBe('SNEAKERS');
    expect(builderTypeOf(null, 'accessory')).toBe('BAG');
    expect(builderTypeOf(null, 'dress')).toBe('DRESS');
    expect(builderTypeOf(null, 'headwear')).toBe('CAP');
  });
});

describe('builderNameOf', () => {
  it('uses the explicit name when set', () => {
    expect(builderNameOf('Forest green sweater', 'Uniqlo', 'SWEATER')).toBe('Forest green sweater');
  });

  it('falls back to brand when name is null', () => {
    expect(builderNameOf(null, 'Uniqlo', 'SWEATER')).toBe('Uniqlo');
  });

  it('falls back to a title-cased type when both name and brand are null', () => {
    expect(builderNameOf(null, null, 'SWEATER')).toBe('Sweater');
  });
});

describe('builderColorOf', () => {
  it('prefers primaryColor over colors[0]', () => {
    expect(builderColorOf('green', ['forest green', 'olive'])).toBe('green');
  });

  it('falls back to colors[0] when primaryColor is null', () => {
    expect(builderColorOf(null, ['forest green', 'olive'])).toBe('forest green');
  });

  it('falls back to an empty string when both are absent', () => {
    expect(builderColorOf(null, [])).toBe('');
  });
});

describe('toBuilderItem', () => {
  it('maps a fully-populated item through unchanged (type/name/color explicit)', () => {
    const item = makeItem();
    const result = toBuilderItem(item);
    expect(result).toEqual({
      id: 'item-1',
      type: 'SWEATER',
      name: 'Forest green sweater',
      color: 'green',
      photo: { id: 'item-1', photoStorage: 'cloud', photoPath: 'user-1/item-1.jpg' },
    });
  });

  it('handles null type, null name, and null primaryColor together', () => {
    const item = makeItem({
      type: null,
      name: null,
      brand: null,
      primaryColor: null,
      colors: ['navy'],
      category: 'outerwear',
    });
    const result = toBuilderItem(item);
    expect(result.type).toBe('JACKET');       // category fallback
    expect(result.name).toBe('Jacket');        // title-cased type fallback
    expect(result.color).toBe('navy');         // colors[0] fallback
  });

  it('handles an item with no color data at all', () => {
    const item = makeItem({ primaryColor: null, colors: [] });
    const result = toBuilderItem(item);
    expect(result.color).toBe('');
  });

  it('carries photoStorage "none" through untouched (no photo yet)', () => {
    const item = makeItem({ photoStorage: 'none', photoPath: null });
    const result = toBuilderItem(item);
    expect(result.photo).toEqual({ id: 'item-1', photoStorage: 'none', photoPath: null });
  });
});

describe('assignBucketKey', () => {
  const buckets = [
    { key: 'TOPS', types: ['TEE', 'SWEATER'] },
    { key: 'BOTTOMS', types: ['JEANS'] },
  ] as const;

  it('returns the bucket whose types list contains the type', () => {
    expect(assignBucketKey('SWEATER', buckets, 'BAGS')).toBe('TOPS');
    expect(assignBucketKey('JEANS', buckets, 'BAGS')).toBe('BOTTOMS');
  });

  it('is case-insensitive', () => {
    expect(assignBucketKey('sweater', buckets, 'BAGS')).toBe('TOPS');
  });

  it('falls back to fallbackKey for a type no bucket lists (e.g. CAP)', () => {
    expect(assignBucketKey('CAP', buckets, 'BAGS')).toBe('BAGS');
  });
});
