// Personal Colour v3 Phase C — "beyond the wardrobe" beauty deliverables per
// 12-tone: wow colours, metal preference, makeup families, hair/glasses
// direction. Pure data module, no native/Expo imports (same constraint as
// tone12.ts/colorMath.ts — importable from Jest without a device).
//
// ALL hexes below are CALIBRATION-PENDING, same disclaimer as TONE12_BOARDS/
// TONE12_DRAPE_HEX in tone12.ts and TONE12_AVOID's colour-name draft — hand-
// picked by design judgment, not yet colourist-reviewed. Makeup hexes are
// their OWN values (lipstick/blush/eyeshadow pigments), not reused wardrobe
// swatches — a wardrobe red and a lipstick red are different products with
// different finish/undertone expectations, even when both "read warm."
import type { ColorTone12 } from './tone12';
import { TONE12_BOARDS } from './tone12';

export interface Tone12Beauty {
  /** 4 hero "wow" colours — hand-picked subset of the tone's 6 accents. */
  wow: string[];
  metal: 'gold' | 'silver' | 'both';
  /** 2 swatch hexes per family (lips/cheeks/eyes) — makeup-specific values. */
  makeup: { lips: string[]; cheeks: string[]; eyes: string[] };
  /** i18n key suffix, resolved via `personalColor_hair_<hairKey>` in the
   *  locale files. */
  hairKey: string;
  /** i18n key suffix, resolved via `personalColor_glasses_<glassesKey>` in
   *  the locale files. */
  glassesKey: string;
}

export const TONE12_BEAUTY: Record<ColorTone12, Tone12Beauty> = {
  // ─── Spring (warm) — gold metal, coral lips / peachy cheeks / golden eyes ─

  light_spring: {
    // Kept: coral, pale yellow, pink, mint — the palest/clearest 4, read
    // most distinctly "Light Spring." Dropped FFB347 (amber — too close to
    // True Spring's warm oranges) and 4FC4D8 (cyan-teal — reads cooler,
    // closer to Light Summer).
    wow: ['#FF8C5A', '#FFD75A', '#FF9AAD', '#5AC48F'],
    metal: 'gold',
    makeup: {
      lips: ['#F2A98C', '#F7C3AE'],
      cheeks: ['#F7C9A8', '#FADCC0'],
      eyes: ['#F2D08A', '#F5E0A8'],
    },
    hairKey: 'goldenBlonde',
    glassesKey: 'lightGoldTortoise',
  },
  true_spring: {
    // Kept: orange-red, golden yellow, grass green, warm pink-red — the
    // archetypal warm-clear quartet. Dropped 2FA8D8 (blue — reads cool,
    // closer to True Summer/Winter) and FFE04C (near-duplicate of the kept
    // golden yellow).
    wow: ['#FF6E3C', '#FFC02E', '#2FB873', '#FF5A7A'],
    metal: 'gold',
    makeup: {
      lips: ['#E8734F', '#F0916A'],
      cheeks: ['#F0A66E', '#F5BE8C'],
      eyes: ['#D9A441', '#E8B95C'],
    },
    hairKey: 'warmGolden',
    glassesKey: 'goldTortoise',
  },
  bright_spring: {
    // Kept: scarlet-orange, bright yellow, green, hot pink — the punchiest
    // clear-warm set. Dropped 00A8E8 and 7A4FE8 (blue/purple — both read
    // closer to Bright Winter's cool-clear jewel tones).
    wow: ['#FF4C2E', '#FFD028', '#00B85F', '#FF3C6E'],
    metal: 'gold',
    makeup: {
      lips: ['#F0532E', '#FF7048'],
      cheeks: ['#F58F52', '#FFAA6E'],
      eyes: ['#E8951E', '#F5AC2E'],
    },
    hairKey: 'vividCopper',
    glassesKey: 'brightGoldTortoise',
  },

  // ─── Summer (cool) — silver metal, mauve/rose lips / dusty-pink cheeks / ──
  // ─── cool taupe-lavender eyes ───────────────────────────────────────────

  light_summer: {
    // Kept: periwinkle, dusty pink, sky blue, seafoam — the palest/clearest
    // cool 4. Dropped B08FC8 (lavender-purple — closer to True Summer) and
    // C88FB8 (orchid-pink — closer to True Summer's berry-pink).
    wow: ['#8FA8D8', '#E8A0B0', '#98C0E8', '#7AB8B0'],
    metal: 'silver',
    makeup: {
      lips: ['#D89CA8', '#E4B4BE'],
      cheeks: ['#E8BEC4', '#F0D2D6'],
      eyes: ['#C8BCD0', '#D8CEDE'],
    },
    hairKey: 'ashBlonde',
    glassesKey: 'silverCrystal',
  },
  true_summer: {
    // Kept: purple, steel blue, berry-pink, mauve-plum — the signature
    // medium-value cool-muted quartet. Dropped 4C8F84 (teal — reads closer
    // to Soft Summer's sage-adjacent greens) and 6F7AB8 (blue-violet —
    // redundant with the kept purple/steel-blue).
    wow: ['#8F6FA8', '#4C7A9E', '#B85C8A', '#A85C7A'],
    metal: 'silver',
    makeup: {
      lips: ['#A8607A', '#B87A90'],
      cheeks: ['#C98A96', '#D6A0AA'],
      eyes: ['#948AA0', '#A89EB0'],
    },
    hairKey: 'ashBrown',
    glassesKey: 'coolSilver',
  },
  soft_summer: {
    // Kept: mauve-plum, dusty rose, sage, rosewood — the lowest-chroma,
    // most "blended" 4. Dropped 5C7A88 (slate blue — closer to True
    // Summer's steel blue) and 6E6F92 (dusty periwinkle — closer to Light/
    // True Summer's blues).
    wow: ['#8A6F84', '#A87A8A', '#5C8578', '#96707E'],
    metal: 'both',
    makeup: {
      lips: ['#8F6270', '#9E7480'],
      cheeks: ['#AC868C', '#BA9A9E'],
      eyes: ['#7E7680', '#8C8690'],
    },
    hairKey: 'mutedAshBrown',
    glassesKey: 'mutedGunmetal',
  },

  // ─── Autumn (warm) — gold metal, brick/terracotta lips / cinnamon cheeks ──
  // ─── / bronze-olive eyes ─────────────────────────────────────────────────

  soft_autumn: {
    // Kept: caramel, olive, terracotta, moss — the dustiest/most-blended 4.
    // Dropped C48A5A (tan-gold — redundant with the kept caramel) and
    // 8A6E7E (dusty mauve — a bridge tone that reads closer to Soft
    // Summer's mauve, undercutting the "on-season" test).
    wow: ['#B87A4C', '#8F9E4C', '#A85C48', '#6E8A5C'],
    metal: 'both',
    makeup: {
      lips: ['#A05C48', '#B0705A'],
      cheeks: ['#B87E5C', '#C6926E'],
      eyes: ['#8A7440', '#9C8656'],
    },
    hairKey: 'mutedChestnut',
    glassesKey: 'warmTortoise',
  },
  true_autumn: {
    // Kept: pumpkin-rust, mustard-gold, olive, brick-red — the archetypal
    // warm-rich-muted quartet (pumpkin-rust doubles as this tone's
    // TONE12_DRAPE_HEX signature). Dropped 8F5C00 (amber-brown — redundant
    // with the kept pumpkin-rust) and 4C6E28 (forest-olive — reads closer
    // to Deep Autumn's darker greens).
    wow: ['#D85A1E', '#C49A00', '#7A8F1E', '#A83C1E'],
    metal: 'gold',
    makeup: {
      lips: ['#B2401E', '#C4522A'],
      cheeks: ['#C46A34', '#D07E48'],
      eyes: ['#8B5A20', '#7A7A2E'],
    },
    hairKey: 'warmChestnut',
    glassesKey: 'warmTortoise',
  },
  deep_autumn: {
    // Kept: brick-red, amber-gold, wine-maroon, dark forest — the deepest/
    // richest 4. Dropped 5C7A1E (olive — too close to True Autumn's olive)
    // and 8F4C00 (burnt-orange — too close to True Autumn's pumpkin-rust).
    wow: ['#A8321E', '#B87400', '#7A1E28', '#3C5C28'],
    metal: 'gold',
    makeup: {
      lips: ['#7A2414', '#8F2E1A'],
      cheeks: ['#8F4E28', '#7A3820'],
      eyes: ['#5C4014', '#4A5420'],
    },
    hairKey: 'deepChestnut',
    glassesKey: 'warmTortoise',
  },

  // ─── Winter (cool) — silver metal, berry/blue-red lips / cool-pink ────────
  // ─── cheeks / charcoal-jewel eyes ────────────────────────────────────────

  bright_winter: {
    // Kept: hot pink-red, cyan, emerald, electric blue — the most vivid
    // clear-cool 4. Dropped B800E8 (magenta-purple — reads closer to
    // Bright Spring's purple) and F2E82E (bright yellow — too warm-leaning
    // for a winter tone, reads closer to Spring).
    wow: ['#FF1E5A', '#00C8E8', '#28E88C', '#0057FF'],
    metal: 'silver',
    makeup: {
      lips: ['#E01050', '#F03060'],
      cheeks: ['#F0507A', '#F86E92'],
      eyes: ['#0F5CC0', '#0F8F5C'],
    },
    hairKey: 'coolBlackBrown',
    glassesKey: 'blackCrystal',
  },
  true_winter: {
    // Kept: true red, royal blue, emerald, purple — the classic cool-clear
    // jewel-tone quartet. Dropped C80F8F (magenta — redundant with the
    // kept purple/pink direction) and 0FC8C8 (teal-cyan — reads closer to
    // Bright Winter's cyan).
    wow: ['#E80F3C', '#0F5CC8', '#0F8F5C', '#8F0FC8'],
    metal: 'silver',
    makeup: {
      lips: ['#A8123C', '#8B1030'],
      cheeks: ['#D06478', '#DC7E90'],
      eyes: ['#2E2E38', '#1E3A5C'],
    },
    hairKey: 'coolBlack',
    glassesKey: 'coolBlackFrame',
  },
  deep_winter: {
    // Kept: deep wine-red, deep royal blue, deep emerald, deep purple — the
    // deepest jewel-tone quartet. Dropped B80F50 (deep magenta-pink —
    // redundant with the kept wine-red) and 0F5C74 (deep teal — reads
    // closer to True Winter's teal-cyan).
    wow: ['#8F0F28', '#0F3C8F', '#0F6444', '#5C0F8F'],
    metal: 'silver',
    makeup: {
      lips: ['#6E0A24', '#5C0818'],
      cheeks: ['#8F3C50', '#7A2E42'],
      eyes: ['#1A1A22', '#14203C'],
    },
    hairKey: 'deepBlack',
    glassesKey: 'deepBlackFrame',
  },
};

// Sanity: every `wow` hex really is one of that tone's 6 accents (guards
// against a typo/rebalance in TONE12_BOARDS silently orphaning a pick) —
// cheap enough to run at module init, also exercised explicitly in
// tone12Beauty.test.ts.
for (const tone of Object.keys(TONE12_BEAUTY) as ColorTone12[]) {
  const accents = TONE12_BOARDS[tone].accents;
  for (const hex of TONE12_BEAUTY[tone].wow) {
    if (!accents.includes(hex)) {
      throw new Error(`TONE12_BEAUTY.${tone}.wow contains ${hex}, not one of TONE12_BOARDS.${tone}.accents`);
    }
  }
}
