import { colorMatch } from '../colorMatch';
import { COLOR_OPTIONS } from '../../features/wardrobe-add/vocab';

describe('colorMatch', () => {
  it('maps pure black/white to the right controlled colours', () => {
    expect(colorMatch({ r: 10, g: 8, b: 6 })).toBe('Black');
    expect(colorMatch({ r: 245, g: 242, b: 235 })).toBe('White');
  });

  it('always returns a valid controlled colour name', () => {
    const samples = [
      { r: 34, g: 48, b: 75 },   // navy-ish
      { r: 90, g: 90, b: 48 },   // olive-ish
      { r: 168, g: 50, b: 44 },  // red-ish
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ];
    for (const s of samples) {
      expect(COLOR_OPTIONS).toContain(colorMatch(s));
    }
  });

  it('defaults to Natural for invalid input', () => {
    expect(colorMatch(null)).toBe('Natural');
    expect(colorMatch(undefined)).toBe('Natural');
  });
});
