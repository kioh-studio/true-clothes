import { formatStatValue } from '../profileStatsFormat';

describe('formatStatValue', () => {
  it('renders a positive count as its decimal string', () => {
    expect(formatStatValue(1)).toBe('1');
    expect(formatStatValue(42)).toBe('42');
  });

  it('renders zero as a quiet dash, not a bare 0', () => {
    expect(formatStatValue(0)).toBe('—');
  });

  it('never returns a negative-looking value for non-negative input', () => {
    expect(formatStatValue(0)).not.toBe('0');
  });
});
