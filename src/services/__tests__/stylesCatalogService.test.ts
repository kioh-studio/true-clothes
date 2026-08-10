// Style catalog expansion (2026-08-10): sortStylesByGenderLean is a pure
// display-order helper — asserting it here (rather than only structurally in
// the Deno engine tests) covers requirement (5): the sort never drops a
// style, regardless of the user's profile gender value.

// sortStylesByGenderLean is a pure function, but stylesCatalogService.ts also
// imports the Supabase client module-level (sb), which throws at import time
// without env vars configured — mock it out, same convention as the other
// service test files (see wardrobeService.test.ts / itemPhotoService.test.ts).
jest.mock('../supabase', () => ({ sb: {} }));

import {
  sortStylesByGenderLean, StyleGenderLean,
  getInitialVisibleStyles, STYLE_CATALOG_INITIAL_VISIBLE,
} from '../stylesCatalogService';

interface Item { id: string; genderLean: StyleGenderLean; }

const CATALOG: Item[] = [
  { id: 'smartcasual', genderLean: 'masculine' },
  { id: 'oldmoney', genderLean: 'masculine' },
  { id: 'minimalist', genderLean: 'neutral' },
  { id: 'athleisure', genderLean: 'neutral' },
  { id: 'y2k', genderLean: 'feminine' },
  { id: 'bohemian', genderLean: 'feminine' },
  { id: 'feminine', genderLean: 'feminine' },
  { id: 'artsy', genderLean: 'neutral' },
];

function idsOf(list: Item[]) { return list.map(s => s.id); }

describe('sortStylesByGenderLean', () => {
  test('WOMAN: feminine-leaning styles surface first, nothing dropped', () => {
    const result = sortStylesByGenderLean(CATALOG, 'WOMAN');
    expect(result).toHaveLength(CATALOG.length);
    expect(new Set(idsOf(result))).toEqual(new Set(idsOf(CATALOG))); // same members
    const firstNonFeminineIdx = result.findIndex(s => s.genderLean !== 'feminine');
    // every feminine entry comes before every non-feminine entry
    for (let i = 0; i < firstNonFeminineIdx; i++) expect(result[i].genderLean).toBe('feminine');
  });

  test('MAN: masculine-leaning styles surface first, nothing dropped', () => {
    const result = sortStylesByGenderLean(CATALOG, 'MAN');
    expect(result).toHaveLength(CATALOG.length);
    expect(new Set(idsOf(result))).toEqual(new Set(idsOf(CATALOG)));
    const firstNonMasculineIdx = result.findIndex(s => s.genderLean !== 'masculine');
    for (let i = 0; i < firstNonMasculineIdx; i++) expect(result[i].genderLean).toBe('masculine');
  });

  test('stable within each group: relative (popularity) order is preserved', () => {
    const result = sortStylesByGenderLean(CATALOG, 'WOMAN');
    const feminineIds = result.filter(s => s.genderLean === 'feminine').map(s => s.id);
    expect(feminineIds).toEqual(['y2k', 'bohemian', 'feminine']); // same relative order as CATALOG
    const restIds = result.filter(s => s.genderLean !== 'feminine').map(s => s.id);
    expect(restIds).toEqual(['smartcasual', 'oldmoney', 'minimalist', 'athleisure', 'artsy']);
  });

  test.each([
    ['NON-BINARY'],
    ['PREFER NOT TO SAY'],
    [''],
    [null],
    [undefined],
  ])('gender=%p leaves the list order unchanged and drops nothing', (gender) => {
    const result = sortStylesByGenderLean(CATALOG, gender as string | null | undefined);
    expect(idsOf(result)).toEqual(idsOf(CATALOG));
  });

  test('does not mutate the input array', () => {
    const copy = [...CATALOG];
    sortStylesByGenderLean(CATALOG, 'WOMAN');
    expect(CATALOG).toEqual(copy);
  });

  test('empty list → empty list', () => {
    expect(sortStylesByGenderLean([], 'WOMAN')).toEqual([]);
  });
});

// "Show all" truncation (style catalog 8→31, 2026-08-11): the grid renders
// only a head slice by default — but a style the user already selected must
// never disappear just because it falls past the cut.
describe('getInitialVisibleStyles', () => {
  // 31-entry catalog, only ids matter here.
  const CATALOG_31: Item[] = Array.from({ length: 31 }, (_, i) => ({
    id: `style-${i}`,
    genderLean: 'neutral' as StyleGenderLean,
  }));

  test('returns only the first N when nothing is selected', () => {
    const result = getInitialVisibleStyles(CATALOG_31, [], 10);
    expect(idsOf(result)).toEqual(CATALOG_31.slice(0, 10).map(s => s.id));
  });

  test('a selected style inside the head slice does not duplicate', () => {
    const result = getInitialVisibleStyles(CATALOG_31, ['style-3'], 10);
    expect(idsOf(result)).toEqual(CATALOG_31.slice(0, 10).map(s => s.id));
    expect(idsOf(result).filter(id => id === 'style-3')).toHaveLength(1);
  });

  test('a selected style OUTSIDE the head slice is appended, never dropped', () => {
    const result = getInitialVisibleStyles(CATALOG_31, ['style-25'], 10);
    expect(idsOf(result)).toEqual([...CATALOG_31.slice(0, 10).map(s => s.id), 'style-25']);
  });

  test('multiple out-of-range selections keep their original relative order', () => {
    const result = getInitialVisibleStyles(CATALOG_31, ['style-25', 'style-15', 'style-30'], 10);
    // style-15 comes before style-25 comes before style-30 in CATALOG_31
    expect(idsOf(result)).toEqual([
      ...CATALOG_31.slice(0, 10).map(s => s.id),
      'style-15', 'style-25', 'style-30',
    ]);
  });

  test('reading the full catalog length back in (post-expand) returns everything unchanged', () => {
    const result = getInitialVisibleStyles(CATALOG_31, [], CATALOG_31.length);
    expect(result).toHaveLength(31);
  });

  test('default initialCount matches STYLE_CATALOG_INITIAL_VISIBLE', () => {
    const result = getInitialVisibleStyles(CATALOG_31, []);
    expect(result).toHaveLength(STYLE_CATALOG_INITIAL_VISIBLE);
  });

  test('does not mutate the input array', () => {
    const copy = [...CATALOG_31];
    getInitialVisibleStyles(CATALOG_31, ['style-25'], 10);
    expect(CATALOG_31).toEqual(copy);
  });

  test('short catalog (fewer than initialCount) returns everything', () => {
    const short = CATALOG_31.slice(0, 5);
    expect(getInitialVisibleStyles(short, [], 10)).toEqual(short);
  });
});
