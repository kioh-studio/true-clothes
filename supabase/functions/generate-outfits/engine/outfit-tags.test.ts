// Deno tests for outfitDominantColor (display-only outfit tag, 2026-07-12).
// Run: deno test supabase/functions/generate-outfits/engine/outfit-tags.test.ts
//
// Guarantees:
//   - the item with the highest statementStrength wins ("loudest piece leads",
//     mirroring the ANCHOR rule in generation.ts)
//   - id tie-break when statementStrength is equal
//   - shoes/accessory are excluded from the anchor pool

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { outfitDominantColor } from './scoring.ts';
import { FitItem, ItemCategory, PrimaryColor } from './types.ts';

function fi(id: string, category: ItemCategory, primaryColor: PrimaryColor, statementStrength: number): FitItem {
  return {
    id,
    category,
    typeName: 'TEE',
    colorProfile: {
      primaryColor, colorLightness: 'medium', colorSaturation: 'muted',
      sat: 20, lum: 50, undertone: 'neutral',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    styleTags: [],
    fit: 'regular',
    formality: 2.5,
    statementStrength,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

Deno.test('outfitDominantColor: the item with the highest statementStrength wins', () => {
  const items = [
    fi('top', 'top', 'navy', 0.3),
    fi('bottom', 'bottom', 'black', 0.9),
    fi('shoes', 'shoes', 'white', 0.1),
  ];
  assertEquals(outfitDominantColor(items), 'black');
});

Deno.test('outfitDominantColor: id tie-break when statementStrength is equal', () => {
  const items = [
    fi('z_top', 'top', 'navy', 0.5),
    fi('a_bottom', 'bottom', 'olive', 0.5),
  ];
  // Equal statementStrength -> lower id ('a_bottom' < 'z_top') wins.
  assertEquals(outfitDominantColor(items), 'olive');
});

Deno.test('outfitDominantColor: shoes and accessory are excluded from the anchor pool even if louder', () => {
  const items = [
    fi('itemA_top', 'top', 'navy', 0.4),
    fi('itemB_bottom', 'bottom', 'black', 0.4),
    fi('shoes', 'shoes', 'red', 0.99),
    fi('accessory', 'accessory', 'yellow', 0.99),
  ];
  // Equal statementStrength between the two eligible items -> smallest id
  // ('itemA_top') wins; the louder shoes/accessory never enter the pool.
  assertEquals(outfitDominantColor(items), 'navy');
});

Deno.test('outfitDominantColor: falls back to the full item pool when only shoes/accessory are present', () => {
  const items = [
    fi('shoes', 'shoes', 'red', 0.2),
    fi('accessory', 'accessory', 'yellow', 0.8),
  ];
  assertEquals(outfitDominantColor(items), 'yellow');
});

Deno.test('outfitDominantColor: empty items defaults to black', () => {
  assertEquals(outfitDominantColor([]), 'black');
});
