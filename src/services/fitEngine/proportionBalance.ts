import { FitItem, ItemFit } from '../../types/fitEngine';

// Volume score: how "big" each fit reads visually.
// Higher = more volume. Used to detect proportion clashes.
const VOLUME: Record<ItemFit, number> = {
  slim: 1,
  regular: 2,
  relaxed: 3,
  wide: 4,
  oversized: 5,
};

// Proportion scoring using STORED fit values (not derived from style tags).
//
// Rules from professional stylists:
// - Contrasting volumes (baggy top + slim bottom, or vice versa) = GOOD
// - Similar moderate volumes = OK
// - Both oversized = BAD (proportion disaster, "drowning in fabric")
// - Both bodycon/slim = context-dependent
// - Rule of Thirds: visual weight should split ~1/3 to 2/3, not 1:1
export function scoreProportionBalance(items: FitItem[]): number {
  const tops = items.filter(i => i.category === 'top' || i.category === 'outwear');
  const bottoms = items.filter(i => i.category === 'bottom');

  if (tops.length === 0 || bottoms.length === 0) return 0.7; // can't evaluate

  const topVolume = Math.max(...tops.map(i => VOLUME[i.fit]));
  const bottomVolume = Math.max(...bottoms.map(i => VOLUME[i.fit]));

  // Both oversized = cardinal sin
  if (topVolume >= 5 && bottomVolume >= 5) return 0.15;
  // Both very relaxed/wide
  if (topVolume >= 4 && bottomVolume >= 4) return 0.35;

  const diff = Math.abs(topVolume - bottomVolume);

  // Ideal: 2-3 levels of contrast
  if (diff >= 2) return 1.0;
  // Moderate contrast
  if (diff === 1) return 0.8;
  // Same volume — OK if moderate, worse if extreme
  if (topVolume <= 2) return 0.65; // both fitted = fine
  return 0.4; // both baggy = not great
}
