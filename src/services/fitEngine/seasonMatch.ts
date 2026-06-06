import { FitItem, Season } from '../../types/fitEngine';

// Season compatibility matrix: how well two seasons go together.
// 1.0 = perfect match, 0.0 = complete mismatch.
const COMPAT: Record<Season, Record<Season, number>> = {
  summer:    { summer: 1.0, spring: 0.8, fall: 0.3, winter: 0.0, allSeason: 0.9 },
  spring:    { summer: 0.8, spring: 1.0, fall: 0.7, winter: 0.3, allSeason: 0.9 },
  fall:      { summer: 0.3, spring: 0.7, fall: 1.0, winter: 0.8, allSeason: 0.9 },
  winter:    { summer: 0.0, spring: 0.3, fall: 0.8, winter: 1.0, allSeason: 0.9 },
  allSeason: { summer: 0.9, spring: 0.9, fall: 0.9, winter: 0.9, allSeason: 1.0 },
};

// Score how seasonally consistent the items in an outfit are.
// A wool coat (winter) + linen shorts (summer) = 0.0 compatibility.
// All cotton basics (summer) + light chinos (summer) = 1.0.
export function scoreSeasonMatch(items: FitItem[]): number {
  const seasons = items.map(i => i.fabric.season);
  if (seasons.length <= 1) return 0.8;

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < seasons.length; i++) {
    for (let j = i + 1; j < seasons.length; j++) {
      total += COMPAT[seasons[i]][seasons[j]];
      pairs++;
    }
  }
  return pairs > 0 ? total / pairs : 0.8;
}
