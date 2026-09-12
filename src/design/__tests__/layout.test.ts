/**
 * Breakpoint + grid math at real device widths.
 *
 * The rest of the suite runs in `testEnvironment: 'node'` and never renders a
 * component, so nothing else here would notice if a breakpoint moved. These
 * hooks hold no React state — with `useWindowDimensions` mocked they are plain
 * functions, so they can be called directly.
 */
let win = { width: 390, height: 844 };

jest.mock('react-native', () => ({
  useWindowDimensions: () => win,
}));

import { useResponsive, useGridColumns, useGridCardWidth, CONTENT_MAX, BP } from '../layout';

const at = (width: number, height = 1366) => {
  win = { width, height };
};

// Portrait widths, per the table in layout.ts.
const IPHONE = 390;
const IPAD_MINI = 744;
const IPAD_PRO_11 = 834;
const IPAD_PRO_13 = 1024;

describe('useResponsive breakpoints', () => {
  it('treats a phone as phone', () => {
    at(IPHONE);
    expect(useResponsive().bp).toBe('phone');
    expect(useResponsive().isTablet).toBe(false);
  });

  it('treats iPad mini and iPad Pro 11 as tablet', () => {
    at(IPAD_MINI);
    expect(useResponsive().bp).toBe('tablet');
    at(IPAD_PRO_11);
    expect(useResponsive().bp).toBe('tablet');
  });

  it('treats iPad Pro 13 portrait as tabletLg', () => {
    at(IPAD_PRO_13);
    expect(useResponsive().bp).toBe('tabletLg');
    expect(useResponsive().isTablet).toBe(true);
  });

  it('is inclusive at each threshold', () => {
    at(BP.tablet - 1);
    expect(useResponsive().bp).toBe('phone');
    at(BP.tablet);
    expect(useResponsive().bp).toBe('tablet');
    at(BP.tabletLg - 1);
    expect(useResponsive().bp).toBe('tablet');
    at(BP.tabletLg);
    expect(useResponsive().bp).toBe('tabletLg');
  });

  it('follows the live width, so rotation and split-screen re-resolve', () => {
    at(IPAD_PRO_13);
    expect(useResponsive().bp).toBe('tabletLg');
    at(IPHONE); // same session, narrower window
    expect(useResponsive().bp).toBe('phone');
  });
});

describe('useGridColumns', () => {
  it('widens the grid as the screen grows', () => {
    at(IPHONE);
    expect(useGridColumns()).toBe(2);
    at(IPAD_PRO_11);
    expect(useGridColumns()).toBe(3);
    at(IPAD_PRO_13);
    expect(useGridColumns()).toBe(4);
  });
});

describe('useGridCardWidth', () => {
  it('splits the usable width across the columns', () => {
    at(IPHONE);
    // (390 - 24*2 - 12*1) / 2
    expect(useGridCardWidth(2)).toBeCloseTo(165);
  });

  it('keeps cards from ballooning on a very wide window', () => {
    at(4000);
    // Clamped to CONTENT_MAX * 2 before the split, not the raw 4000.
    expect(useGridCardWidth(4)).toBeCloseTo((CONTENT_MAX * 2 - 48 - 36) / 4);
  });

  it('gives a sane card at iPad Pro 13 in its own column count', () => {
    at(IPAD_PRO_13);
    const w = useGridCardWidth(useGridColumns());
    expect(w).toBeGreaterThan(150);
    expect(w).toBeLessThan(IPAD_PRO_13 / 2);
  });
});
