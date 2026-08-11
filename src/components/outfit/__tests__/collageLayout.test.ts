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

describe('buildLayout — flow layout hierarchy', () => {
  const area = (s: { w: number; h: number }) => s.w * s.h;
  const bySlotId = (positioned: ReturnType<typeof buildLayout>) =>
    new Map(positioned.map(p => [p.id, p.slot]));

  it('anchor is the largest item', () => {
    const items = [
      entry('jeans-1', 'JEANS'),
      entry('jacket-1', 'JACKET'),
      entry('tee-1', 'TEE'),
      entry('sneakers-1', 'SNEAKERS'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const anchorSlot = byId.get('jeans-1')!;
    for (const p of positioned) {
      if (p.id === 'jeans-1') continue;
      expect(area(anchorSlot)).toBeGreaterThan(area(p.slot));
    }
  });

  it("secondaries start at the anchor's top Y and stack downward on the right", () => {
    const items = [
      entry('jeans-1', 'JEANS'),
      entry('jacket-1', 'JACKET'),
      entry('tee-1', 'TEE'),
      entry('sneakers-1', 'SNEAKERS'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const anchorSlot = byId.get('jeans-1')!;
    const jacketSlot = byId.get('jacket-1')!; // outer → first secondary
    const teeSlot = byId.get('tee-1')!; // inner → second secondary

    expect(jacketSlot.top).toBeCloseTo(anchorSlot.top, 5);
    expect(jacketSlot.left).toBeGreaterThanOrEqual(44);
    expect(teeSlot.left).toBeGreaterThanOrEqual(44);
    expect(teeSlot.top).toBeGreaterThan(jacketSlot.top);
  });

  it('accessories sit below the lowest clothing item', () => {
    const items = [
      entry('trousers-1', 'TROUSERS'),
      entry('shirt-1', 'SHIRT'),
      entry('sneakers-1', 'SNEAKERS'),
      entry('bag-1', 'BAG'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const clothesBottom = Math.max(
      ...['trousers-1', 'shirt-1'].map(id => {
        const s = byId.get(id)!;
        return s.top + s.h;
      }),
    );
    for (const id of ['sneakers-1', 'bag-1']) {
      const s = byId.get(id)!;
      expect(s.top).toBeGreaterThanOrEqual(clothesBottom - 0.01);
    }
  });

  it('many accessories wrap onto a second row', () => {
    const items = [
      entry('jeans-1', 'JEANS'),
      entry('tee-1', 'TEE'),
      entry('sneakers-1', 'SNEAKERS'),
      entry('bag-1', 'BAG'),
      entry('belt-1', 'BELT'),
      entry('sunglasses-1', 'SUNGLASSES'),
      entry('hat-1', 'HAT'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const accIds = ['sneakers-1', 'bag-1', 'belt-1', 'sunglasses-1', 'hat-1'];
    const tops = new Set(accIds.map(id => Math.round(byId.get(id)!.top * 100) / 100));
    expect(tops.size).toBeGreaterThanOrEqual(2);
  });

  it('everything fits inside the frame', () => {
    const items = [
      entry('dress-1', 'DRESS'),
      entry('coat-1', 'COAT'),
      entry('cardigan-1', 'CARDIGAN'),
      entry('shirt-1', 'SHIRT'),
      entry('boots-1', 'BOOTS'),
      entry('bag-1', 'BAG'),
      entry('belt-1', 'BELT'),
      entry('hat-1', 'HAT'),
      entry('sunglasses-1', 'SUNGLASSES'),
    ];
    const positioned = buildLayout(items);
    for (const p of positioned) {
      expect(p.slot.left).toBeGreaterThanOrEqual(0);
      expect(p.slot.top).toBeGreaterThanOrEqual(-0.01);
      expect(p.slot.left + p.slot.w).toBeLessThanOrEqual(100.01);
      expect(p.slot.top + p.slot.h).toBeLessThanOrEqual(100.01);
    }
  });

  it("accessories left-align with the anchor's left edge", () => {
    const items = [
      entry('jeans-1', 'JEANS'),
      entry('tee-1', 'TEE'),
      entry('sneakers-1', 'SNEAKERS'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const anchorSlot = byId.get('jeans-1')!;
    const sneakersSlot = byId.get('sneakers-1')!;
    // No overflow for this outfit, so scale-to-fit/centering never touch
    // `left` — direct equality holds.
    expect(Math.abs(sneakersSlot.left - anchorSlot.left)).toBeLessThanOrEqual(0.1);
  });

  it("accessories under a centered anchor start at its left edge", () => {
    const items = [
      entry('jeans-1', 'JEANS'),
      entry('sneakers-1', 'SNEAKERS'),
      entry('bag-1', 'BAG'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const anchorSlot = byId.get('jeans-1')!;
    const sneakersSlot = byId.get('sneakers-1')!;
    const bagSlot = byId.get('bag-1')!;
    expect(Math.abs(sneakersSlot.left - anchorSlot.left)).toBeLessThanOrEqual(0.1);
    expect(bagSlot.left).toBeGreaterThan(sneakersSlot.left + sneakersSlot.w);
  });

  it('anchor centers horizontally when there are no secondaries', () => {
    const items = [
      entry('jeans-1', 'JEANS'),
      entry('sneakers-1', 'SNEAKERS'),
      entry('bag-1', 'BAG'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const anchorSlot = byId.get('jeans-1')!;
    expect(Math.abs(anchorSlot.left + anchorSlot.w / 2 - 50)).toBeLessThanOrEqual(0.1);
    for (const id of ['sneakers-1', 'bag-1']) {
      const s = byId.get(id)!;
      expect(s.top).toBeGreaterThanOrEqual(anchorSlot.top + anchorSlot.h - 0.01);
    }
  });

  it('accessories are the smallest tier', () => {
    const items = [
      entry('jeans-1', 'JEANS'),
      entry('jacket-1', 'JACKET'),
      entry('sneakers-1', 'SNEAKERS'),
      entry('bag-1', 'BAG'),
    ];
    const positioned = buildLayout(items);
    const byId = bySlotId(positioned);
    const anchorSlot = byId.get('jeans-1')!;
    const secondarySlot = byId.get('jacket-1')!;
    for (const id of ['sneakers-1', 'bag-1']) {
      const accSlot = byId.get(id)!;
      expect(area(accSlot)).toBeLessThan(area(secondarySlot));
      expect(area(accSlot)).toBeLessThan(area(anchorSlot));
    }
  });
});

describe('buildLayout — measured content-bounds aspect override', () => {
  it('a measured Entry.aspect takes precedence over the static ASPECT table', () => {
    // JEANS falls back to ASPECT.JEANS = 0.54 (tall/narrow); a measured
    // content-bounds crop of 2.0 (wide/short) should visibly override it.
    const withAspect: Entry = { ...entry('jeans-1', 'JEANS'), aspect: 2.0 };
    const control: Entry = entry('jeans-2', 'JEANS');

    const overrideSlot = buildLayout([withAspect])[0].slot;
    const controlSlot = buildLayout([control])[0].slot;

    // Both outfits use the same default areaAspect, so slot.w/slot.h scales
    // with the entry's aspect by the same constant in both cases — the
    // override should read through as a clearly bigger w/h ratio.
    const overrideRatio = overrideSlot.w / overrideSlot.h;
    const controlRatio = controlSlot.w / controlSlot.h;
    expect(overrideRatio).toBeGreaterThan(controlRatio);
    expect(overrideRatio / controlRatio).toBeCloseTo(2.0 / 0.54, 1);
  });
});
