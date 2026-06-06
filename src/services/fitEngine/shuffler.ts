// Deterministic daily shuffle: same userId + calendar day → same ordering.
// Respects style tiers: user-matching outfits always before flex/discovery.
// Within each style tier, sub-shuffles by quality thirds for daily variety.

import { ScoredOutfit } from '../../types/fitEngine';

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Mulberry32 PRNG — fast, seeded, good distribution
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle within quality thirds (top/mid/bottom) to add daily variety
// while preserving general quality ordering.
function shuffleByThirds<T>(items: T[], rand: () => number): T[] {
  if (items.length <= 3) return items;

  const t1End = Math.ceil(items.length / 3);
  const t2End = Math.ceil((items.length * 2) / 3);

  const top = seededShuffle(items.slice(0, t1End), rand);
  const mid = seededShuffle(items.slice(t1End, t2End), rand);
  const bot = seededShuffle(items.slice(t2End), rand);

  return [...top, ...mid, ...bot];
}

// Style-tier-aware shuffle: tier 1 (user style match) always before tier 2 (flex).
// Within each tier, shuffle by quality thirds for variety.
export function dailyShuffle(items: ScoredOutfit[], userId: string): ScoredOutfit[] {
  if (items.length <= 1) return items;

  const d = new Date();
  const key = `${userId}:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const rand = mulberry32(hashStr(key));

  // Split by style tier (already sorted: tier 1 first, tier 2 after)
  const styleTier1 = items.filter(i => i.tier === 1);
  const styleTier2 = items.filter(i => i.tier === 2);

  // Shuffle within quality thirds inside each style tier
  const shuffled1 = shuffleByThirds(styleTier1, rand);
  const shuffled2 = shuffleByThirds(styleTier2, rand);

  return [...shuffled1, ...shuffled2];
}
