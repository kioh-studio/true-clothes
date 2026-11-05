import { parsePrice } from '../parsePrice';

describe('parsePrice', () => {
  it('parses dot and comma decimals', () => {
    expect(parsePrice('12.5')).toBe(12.5);
    expect(parsePrice(' 12,5 ')).toBe(12.5);
  });
  it('empty clears to null', () => expect(parsePrice('  ')).toBeNull());
  it('rejects invalid and negative', () => {
    expect(parsePrice('abc')).toBeUndefined();
    expect(parsePrice('-3')).toBeUndefined();
  });
});
