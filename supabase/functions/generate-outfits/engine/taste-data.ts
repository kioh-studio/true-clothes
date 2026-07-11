// Static taste knowledge — classic combinations and register clashes.
// Extracted from scoring.ts and expanded 2026-07-02 (27 → ~150 triples,
// 7 → ~22 pairs). Pure data, no logic: scoring.ts consumes both tables in
// scoreTasteAdjustment. Curated by hand (LLM-assisted offline), reviewable
// line-by-line; values are tunable.
//
// Conventions:
// • CLASSIC_TRIPLES — keyed 'LEAD+BOTTOM+SHOES' by typeName. The lead slot is
//   either a category-'top' garment or a look-defining OUTERWEAR piece
//   (hoodie, blazer, jacket, coat, parka) — scoring.ts looks up both and takes
//   the stronger. Bonus is a flat ADDITION to totalScore: 0.07–0.08 iconic,
//   0.05–0.06 solid classic, 0.03–0.04 dependable everyday pairing.
// • CLASHING_PAIRS — [typeA, typeB, multiplier ≤ 1]. Applied multiplicatively
//   whenever both types appear in one outfit. ≤0.55 = genuine register clash,
//   0.6–0.8 = usually off, 0.85–0.9 = token penalty on a divisive-but-real look.

export const CLASSIC_TRIPLES: Record<string, number> = {
  // ── LOAFERS — smart-casual / old-money core ────────────────────────────────
  'SHIRT+TROUSERS+LOAFERS': 0.08,
  'SHIRT+CHINOS+LOAFERS': 0.06,
  'SHIRT+JEANS+LOAFERS': 0.05,
  'SHIRT+SHORTS+LOAFERS': 0.05,   // preppy summer (tailored shorts, no-sock loafers)
  'SHIRT+SKIRT+LOAFERS': 0.05,
  'KNIT+TROUSERS+LOAFERS': 0.07,
  'KNIT+CHINOS+LOAFERS': 0.06,
  'KNIT+JEANS+LOAFERS': 0.04,
  'KNIT+SKIRT+LOAFERS': 0.05,
  'SWEATER+TROUSERS+LOAFERS': 0.07,
  'SWEATER+CHINOS+LOAFERS': 0.05,
  'POLO+CHINOS+LOAFERS': 0.06,
  'POLO+TROUSERS+LOAFERS': 0.05,
  'POLO+SHORTS+LOAFERS': 0.05,
  'TEE+TROUSERS+LOAFERS': 0.05,   // minimalist classic — clean tee + tailored trouser
  'TEE+CHINOS+LOAFERS': 0.04,
  'CARDIGAN+TROUSERS+LOAFERS': 0.05,
  'CARDIGAN+CHINOS+LOAFERS': 0.04,
  'BLOUSE+TROUSERS+LOAFERS': 0.06,
  'BLOUSE+SKIRT+LOAFERS': 0.05,
  'VEST+TROUSERS+LOAFERS': 0.06,
  'HENLEY+CHINOS+LOAFERS': 0.03,
  'CAMISOLE+TROUSERS+LOAFERS': 0.04,

  // ── OXFORDS — the formal end ───────────────────────────────────────────────
  'SHIRT+TROUSERS+OXFORDS': 0.08,
  'SHIRT+CHINOS+OXFORDS': 0.06,
  'KNIT+TROUSERS+OXFORDS': 0.06,
  'SWEATER+TROUSERS+OXFORDS': 0.06,
  'BLOUSE+TROUSERS+OXFORDS': 0.06,
  'VEST+TROUSERS+OXFORDS': 0.06,
  'SHIRT+SKIRT+OXFORDS': 0.04,
  'BLOUSE+SKIRT+OXFORDS': 0.04,
  'POLO+TROUSERS+OXFORDS': 0.04,

  // ── SNEAKERS — casual / street backbone ────────────────────────────────────
  'TEE+JEANS+SNEAKERS': 0.06,
  'TEE+CHINOS+SNEAKERS': 0.04,
  'TEE+SHORTS+SNEAKERS': 0.04,
  'TEE+SKIRT+SNEAKERS': 0.04,
  'TEE+LEGGINGS+SNEAKERS': 0.04,  // athleisure staple
  'SHIRT+JEANS+SNEAKERS': 0.04,
  'SHIRT+CHINOS+SNEAKERS': 0.05,
  'SHIRT+TROUSERS+SNEAKERS': 0.04, // smart-casual sneaker
  'POLO+JEANS+SNEAKERS': 0.04,
  'POLO+CHINOS+SNEAKERS': 0.05,
  'POLO+SHORTS+SNEAKERS': 0.05,
  'KNIT+JEANS+SNEAKERS': 0.04,
  'KNIT+TROUSERS+SNEAKERS': 0.05,
  'SWEATER+JEANS+SNEAKERS': 0.05,
  'SWEATER+CHINOS+SNEAKERS': 0.05,
  'SWEATER+LEGGINGS+SNEAKERS': 0.04,
  'HOODIE+JEANS+SNEAKERS': 0.05,
  'HOODIE+SHORTS+SNEAKERS': 0.04,
  'HOODIE+CHINOS+SNEAKERS': 0.04,
  'HOODIE+LEGGINGS+SNEAKERS': 0.04,
  'HENLEY+JEANS+SNEAKERS': 0.05,
  'HENLEY+CHINOS+SNEAKERS': 0.04,
  'CARDIGAN+JEANS+SNEAKERS': 0.04,
  'BLOUSE+JEANS+SNEAKERS': 0.04,
  'BLOUSE+TROUSERS+SNEAKERS': 0.03,
  'CAMISOLE+JEANS+SNEAKERS': 0.04,
  'CAMISOLE+SHORTS+SNEAKERS': 0.03,
  'CROP+JEANS+SNEAKERS': 0.05,
  'CROP+SKIRT+SNEAKERS': 0.04,
  'CROP+LEGGINGS+SNEAKERS': 0.04,
  'CROP+SHORTS+SNEAKERS': 0.04,
  'BODYSUIT+JEANS+SNEAKERS': 0.05,
  'TUNIC+LEGGINGS+SNEAKERS': 0.05,

  // ── BOOTS — fall/winter anchor ─────────────────────────────────────────────
  'KNIT+JEANS+BOOTS': 0.05,
  'KNIT+SKIRT+BOOTS': 0.06,
  'KNIT+TROUSERS+BOOTS': 0.05,
  'KNIT+LEGGINGS+BOOTS': 0.04,
  'SWEATER+JEANS+BOOTS': 0.05,
  'SWEATER+SKIRT+BOOTS': 0.06,
  'SWEATER+TROUSERS+BOOTS': 0.05,
  'SWEATER+LEGGINGS+BOOTS': 0.05,
  'SHIRT+JEANS+BOOTS': 0.05,
  'SHIRT+CHINOS+BOOTS': 0.04,
  'TEE+JEANS+BOOTS': 0.05,
  'TEE+SKIRT+BOOTS': 0.04,
  'HENLEY+JEANS+BOOTS': 0.05,
  'BLOUSE+JEANS+BOOTS': 0.05,
  'BLOUSE+SKIRT+BOOTS': 0.05,
  'CARDIGAN+JEANS+BOOTS': 0.04,
  'TUNIC+LEGGINGS+BOOTS': 0.05,
  'HOODIE+JEANS+BOOTS': 0.03,
  'CROP+JEANS+BOOTS': 0.04,

  // ── HEELS — evening / polished feminine ────────────────────────────────────
  'BLOUSE+SKIRT+HEELS': 0.06,
  'BLOUSE+TROUSERS+HEELS': 0.06,
  'BLOUSE+JEANS+HEELS': 0.05,
  'SHIRT+SKIRT+HEELS': 0.05,
  'SHIRT+TROUSERS+HEELS': 0.06,
  'KNIT+TROUSERS+HEELS': 0.05,
  'KNIT+SKIRT+HEELS': 0.05,
  'SWEATER+SKIRT+HEELS': 0.04,
  'CAMISOLE+TROUSERS+HEELS': 0.05,
  'CAMISOLE+SKIRT+HEELS': 0.06,
  'CAMISOLE+JEANS+HEELS': 0.05,
  'BODYSUIT+JEANS+HEELS': 0.06,
  'BODYSUIT+TROUSERS+HEELS': 0.06,
  'BODYSUIT+SKIRT+HEELS': 0.05,
  'TEE+TROUSERS+HEELS': 0.04,     // undone-chic: casual top, sharp bottom
  'TEE+JEANS+HEELS': 0.04,
  'CROP+SKIRT+HEELS': 0.04,
  'CROP+TROUSERS+HEELS': 0.04,
  'CORSET+TROUSERS+HEELS': 0.05,
  'CORSET+JEANS+HEELS': 0.04,
  'VEST+TROUSERS+HEELS': 0.05,

  // ── SANDALS — warm-weather ease ────────────────────────────────────────────
  'TEE+SHORTS+SANDALS': 0.04,
  'TEE+JEANS+SANDALS': 0.03,
  'TEE+SKIRT+SANDALS': 0.04,
  'SHIRT+SHORTS+SANDALS': 0.04,   // linen-summer read
  'POLO+SHORTS+SANDALS': 0.03,
  'BLOUSE+SKIRT+SANDALS': 0.05,
  'BLOUSE+JEANS+SANDALS': 0.03,
  'CAMISOLE+SKIRT+SANDALS': 0.05,
  'CAMISOLE+SHORTS+SANDALS': 0.04,
  'TUNIC+SHORTS+SANDALS': 0.04,
  'CROP+SHORTS+SANDALS': 0.04,
  'CROP+SKIRT+SANDALS': 0.04,

  // ── FLATS — quiet polish ───────────────────────────────────────────────────
  'BLOUSE+SKIRT+FLATS': 0.05,
  'BLOUSE+TROUSERS+FLATS': 0.05,
  'BLOUSE+JEANS+FLATS': 0.04,
  'SHIRT+TROUSERS+FLATS': 0.05,
  'SHIRT+SKIRT+FLATS': 0.04,
  'TEE+JEANS+FLATS': 0.04,
  'TEE+SKIRT+FLATS': 0.04,
  'KNIT+SKIRT+FLATS': 0.05,
  'KNIT+TROUSERS+FLATS': 0.04,
  'SWEATER+SKIRT+FLATS': 0.04,
  'CARDIGAN+SKIRT+FLATS': 0.04,
  'CAMISOLE+TROUSERS+FLATS': 0.04,

  // ── MULES — relaxed-polished transitional ──────────────────────────────────
  'BLOUSE+TROUSERS+MULES': 0.05,
  'BLOUSE+JEANS+MULES': 0.04,
  'BLOUSE+SKIRT+MULES': 0.04,
  'CAMISOLE+TROUSERS+MULES': 0.05,
  'CAMISOLE+JEANS+MULES': 0.04,
  'KNIT+TROUSERS+MULES': 0.04,
  'SHIRT+TROUSERS+MULES': 0.04,
  'TEE+JEANS+MULES': 0.04,

  // ── WEDGES — summer occasion ───────────────────────────────────────────────
  'BLOUSE+SKIRT+WEDGES': 0.04,
  'BLOUSE+JEANS+WEDGES': 0.03,
  'CAMISOLE+SKIRT+WEDGES': 0.04,
  'CAMISOLE+SHORTS+WEDGES': 0.03,
  'TUNIC+SHORTS+WEDGES': 0.03,

  // ── OUTERWEAR-LED looks (matched against the outwear slot) ────────────────
  'BLAZER+TROUSERS+LOAFERS': 0.07,
  'BLAZER+TROUSERS+OXFORDS': 0.07,
  'BLAZER+JEANS+LOAFERS': 0.05,
  'BLAZER+JEANS+SNEAKERS': 0.04,  // smart-casual staple
  'BLAZER+SKIRT+HEELS': 0.06,
  'BLAZER+TROUSERS+HEELS': 0.06,
  'BLAZER+CHINOS+LOAFERS': 0.05,
  'JACKET+JEANS+SNEAKERS': 0.04,
  'JACKET+JEANS+BOOTS': 0.05,     // denim/leather jacket read
  'JACKET+CHINOS+SNEAKERS': 0.03,
  'COAT+TROUSERS+LOAFERS': 0.05,
  'COAT+TROUSERS+BOOTS': 0.05,
  'COAT+JEANS+BOOTS': 0.04,
  'PARKA+JEANS+SNEAKERS': 0.04,
  'PARKA+JEANS+BOOTS': 0.04,
};

export const CLASHING_PAIRS: Array<[string, string, number]> = [
  // Genuine register clashes — strong vetoes
  ['SANDALS', 'TROUSERS', 0.45],
  ['SANDALS', 'BLAZER', 0.5],
  ['SANDALS', 'OVERCOAT', 0.4],
  ['SANDALS', 'COAT', 0.5],
  ['SANDALS', 'PARKA', 0.45],
  ['OXFORDS', 'SHORTS', 0.4],
  ['OXFORDS', 'LEGGINGS', 0.4],
  ['OXFORDS', 'HOODIE', 0.5],
  ['OVERCOAT', 'SHORTS', 0.4],
  ['HEELS', 'SHORTS', 0.55],

  // Usually off — medium penalty
  ['HEELS', 'LEGGINGS', 0.6],
  ['HEELS', 'HOODIE', 0.6],
  ['LOAFERS', 'LEGGINGS', 0.6],
  ['BLAZER', 'LEGGINGS', 0.6],
  ['CAP', 'HEELS', 0.6],
  ['CAP', 'BLAZER', 0.7],
  ['WEDGES', 'TROUSERS', 0.75],
  ['SANDALS', 'SWEATER', 0.8],

  // Divisive but real contemporary looks — token penalty only
  ['LOAFERS', 'SHORTS', 0.9],     // preppy summer classic
  ['PARKA', 'TROUSERS', 0.85],    // city-winter layering
  ['HOODIE', 'TROUSERS', 0.85],   // athflow
];
