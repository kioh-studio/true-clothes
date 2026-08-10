import { DRAPE_ROUNDS } from '../drapeRounds';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_AXES = new Set(['warmth', 'value', 'chroma']);

describe('DRAPE_ROUNDS', () => {
  test('has exactly 5 rounds', () => {
    expect(DRAPE_ROUNDS).toHaveLength(5);
  });

  test('every round has a valid axis and two parseable hex colours', () => {
    for (const round of DRAPE_ROUNDS) {
      expect(VALID_AXES.has(round.axis)).toBe(true);
      expect(round.left).toMatch(HEX_RE);
      expect(round.right).toMatch(HEX_RE);
      expect(round.left).not.toBe(round.right);
    }
  });

  test('only the last round carries a metal side-effect, and it is gold/silver on opposite sides', () => {
    const withMetal = DRAPE_ROUNDS.filter(r => r.leftMetal || r.rightMetal);
    expect(withMetal).toHaveLength(1);
    const metalRound = DRAPE_ROUNDS[DRAPE_ROUNDS.length - 1];
    expect(metalRound.leftMetal).toBe('gold');
    expect(metalRound.rightMetal).toBe('silver');
  });

  test('rounds 1-4 carry no metal side-effect', () => {
    for (const round of DRAPE_ROUNDS.slice(0, 4)) {
      expect(round.leftMetal).toBeUndefined();
      expect(round.rightMetal).toBeUndefined();
    }
  });
});
