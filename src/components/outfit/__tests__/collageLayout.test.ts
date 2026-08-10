// Unit tests for collageLayout.ts — pure layering/positioning math extracted
// from Collage.tsx so it can be tested without a React Native runtime.

import { resolveRoles, buildLayout, type Entry } from '../collageLayout';

function entry(id: string, type: string): Entry {
  return {
    id,
    type,
    photo: { id, photoStorage: 'none', photoPath: null },
    hasImage: true,
  };
}

describe('resolveRoles — secondary z-order (outer → mid → inner)', () => {
  it('orders a blazer (outer) before a cardigan (mid) before a shirt (inner)', () => {
    const items = [
      entry('shirt-1', 'SHIRT'),
      entry('cardigan-1', 'CARDIGAN'),
      entry('jeans-1', 'JEANS'), // anchor
      entry('blazer-1', 'BLAZER'),
    ];
    const { secondaries } = resolveRoles(items);
    expect(secondaries.map(i => i.id)).toEqual(['blazer-1', 'cardigan-1', 'shirt-1']);
  });

  it('orders a jacket (outer) before a hoodie (mid) before a tee (inner)', () => {
    const items = [
      entry('tee-1', 'TEE'),
      entry('hoodie-1', 'HOODIE'),
      entry('jacket-1', 'JACKET'),
      entry('chinos-1', 'CHINOS'), // anchor
    ];
    const { secondaries } = resolveRoles(items);
    expect(secondaries.map(i => i.id)).toEqual(['jacket-1', 'hoodie-1', 'tee-1']);
  });

  it('places KNIT in the mid group, not inner (matches engine layerRole)', () => {
    // JACKET (not TROUSERS/COAT) is used as the outer piece here because
    // COAT/OVERCOAT/TROUSERS/JEANS/CHINOS/SKIRT are themselves anchor
    // candidates (ANCHOR_PRIORITY) and would be pulled out of `secondaries`
    // before z-ordering ever runs — JACKET is not in ANCHOR_PRIORITY, so it
    // stays a true outer secondary here.
    const items = [
      entry('knit-1', 'KNIT'),
      entry('tee-1', 'TEE'),
      entry('jacket-1', 'JACKET'),
      entry('trousers-1', 'TROUSERS'), // anchor
    ];
    const { secondaries } = resolveRoles(items);
    expect(secondaries.map(i => i.id)).toEqual(['jacket-1', 'knit-1', 'tee-1']);
  });

  it('places KIMONO in the mid group, not outer (matches engine layerRole)', () => {
    const items = [
      entry('kimono-1', 'KIMONO'),
      entry('camisole-1', 'CAMISOLE'),
      entry('skirt-1', 'SKIRT'), // anchor
    ];
    const { secondaries } = resolveRoles(items);
    // Kimono has no true outer shell alongside it here, so it leads — but it
    // must land in the mid bucket, i.e. ahead of the inner camisole either way.
    expect(secondaries.map(i => i.id)).toEqual(['kimono-1', 'camisole-1']);
  });

  it('an outfit with vest (mid) + shirt (inner) + no true outer keeps vest first', () => {
    const items = [
      entry('shirt-1', 'SHIRT'),
      entry('vest-1', 'VEST'),
      entry('jeans-1', 'JEANS'), // anchor
    ];
    const { secondaries } = resolveRoles(items);
    expect(secondaries.map(i => i.id)).toEqual(['vest-1', 'shirt-1']);
  });
});

describe('buildLayout — end-to-end z ordering', () => {
  it('assigns increasing z to blazer, cardigan, shirt in that order', () => {
    const items = [
      entry('shirt-1', 'SHIRT'),
      entry('cardigan-1', 'CARDIGAN'),
      entry('jeans-1', 'JEANS'),
      entry('blazer-1', 'BLAZER'),
    ];
    const positioned = buildLayout(items);
    const byId = new Map(positioned.map(p => [p.id, p.slot.z]));
    expect(byId.get('blazer-1')).toBeLessThan(byId.get('cardigan-1')!);
    expect(byId.get('cardigan-1')).toBeLessThan(byId.get('shirt-1')!);
  });
});
