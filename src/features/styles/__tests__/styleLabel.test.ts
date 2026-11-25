import { styleName, styleDesc, styleLabelFromAny } from '../styleLabel';

const dict: Record<string, string> = { style_oldmoney_name: 'Old Money', style_parisian_name: 'Parisian Chic', style_elegant_name: 'Thanh lịch', style_elegant_desc: 'Mô tả' };
const t = (k: string, o?: { defaultValue?: string }) => dict[k] ?? o?.defaultValue ?? k;

describe('styleLabel', () => {
  it('uses the translation when the key exists', () => {
    expect(styleName('elegant', 'Elegant', t)).toBe('Thanh lịch');
    expect(styleDesc('elegant', 'x', t)).toBe('Mô tả');
  });
  it('falls back when the key is missing', () => {
    expect(styleName('zzz', 'Zzz', t)).toBe('Zzz');
    expect(styleDesc('zzz', 'fallback', t)).toBe('fallback');
  });
  it('resolves ids, upper-cased ids and display names', () => {
    expect(styleLabelFromAny('ELEGANT', t)).toBe('Thanh lịch');
    expect(styleLabelFromAny('Parisian Chic', t)).toBe('Parisian Chic');
    expect(styleLabelFromAny('PARISIAN CHIC', t)).toBe('Parisian Chic');
    expect(styleLabelFromAny('CUSTOM', t)).toBe('CUSTOM');
    expect(styleLabelFromAny(undefined, t)).toBe('');
  });
});
