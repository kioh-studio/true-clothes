import { FitItem } from '../../types/fitEngine';

// ─── Anchor Clarity Scorer ──────────────────────────────────────────────────
// Implements the "One Hero Piece" principle from professional styling:
//   - Every great outfit has ONE item with the most visual weight (hero)
//   - Everything else is quieter (base/support/sidekick)
//   - Multiple loud items competing = visual chaos
//   - All quiet items = boring, no focal point
//
// Uses statementStrength (0–5) derived at classification time from:
//   pattern loudness + graphic weight + color saturation + subtype drama

// Minimum statement strength to qualify as a potential hero
const HERO_THRESHOLD = 1.5;

// Maximum statement strength for a "quiet" supporting item
const SUPPORT_THRESHOLD = 1.0;

export function scoreAnchorClarity(items: FitItem[]): number {
  if (items.length <= 1) return 0.7;

  const strengths = items.map(i => i.statementStrength);
  const sorted = [...strengths].sort((a, b) => b - a);

  const loudest = sorted[0];
  const secondLoudest = sorted[1];

  // Case 1: No hero — all items are quiet (max < threshold)
  // This is "correct but uninspired" — safe but lacks focal point
  if (loudest < HERO_THRESHOLD) {
    return 0.5;
  }

  // Case 2: Clear hero — loudest item stands out significantly
  const heroGap = loudest - secondLoudest;

  if (heroGap >= 1.5) {
    // Strong hero with clear separation — ideal outfit
    // Bonus: are the support items actually quiet?
    const supportItems = sorted.slice(1);
    const quietSupport = supportItems.filter(s => s <= SUPPORT_THRESHOLD).length;
    const supportRatio = quietSupport / supportItems.length;

    // All supports are quiet → perfect. Some loud → less ideal.
    return 0.85 + 0.15 * supportRatio;
  }

  if (heroGap >= 0.8) {
    // Moderate hero separation — decent but not crisp
    return 0.75;
  }

  // Case 3: Multiple competing loud items
  const loudItems = strengths.filter(s => s >= HERO_THRESHOLD).length;

  if (loudItems >= 3) {
    // Three or more loud items = visual noise
    return 0.2;
  }

  if (loudItems === 2) {
    // Two loud items — can work if they're not too close in strength
    // and one is clearly the anchor
    return heroGap >= 0.5 ? 0.55 : 0.35;
  }

  return 0.6;
}
