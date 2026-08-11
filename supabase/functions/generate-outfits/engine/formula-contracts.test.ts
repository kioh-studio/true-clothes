// Deno tests for formula-aware scoring contracts (S1) and the MIEN house POV
// layer (S4), both landed 2026-07-02.
//
// S1 guarantees:
//   - monochrome: tight tonal range + texture variety is REWARDED, not scored
//     as missing contrast; without texture variety the old penalty stands
//   - all-dark-muted outfits escape the flat-look veto when textures differ
//   - texture_stack: 3 distinct fabric weights score as deliberate depth
// S4 guarantees:
//   - restrained natural-fabric neutral looks earn a positive house delta
//   - loud graphics earn a negative delta
//   - opposed user styles (streetwear/y2k) halve the house voice
//   - delta is bounded ±0.05
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  scoreColorHarmony, scoreTextureHarmony, scoreTasteAdjustment, housePOVDelta,
} from './scoring.ts';
import { FitItem, ItemCategory, FabricWeight, GraphicWeight } from './types.ts';

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    lum?: number; sat?: number; primaryColor?: string; fabricName?: string;
    fabricWeight?: FabricWeight; fit?: FitItem['fit']; graphicWeight?: GraphicWeight;
    saturation?: 'muted' | 'balanced' | 'vivid'; typeName?: string;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: {
      primaryColor: (opts.primaryColor ?? 'navy') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'dark',
      colorSaturation: opts.saturation ?? 'muted',
      sat: opts.sat ?? 20,
      lum: opts.lum ?? 30,
      undertone: 'neutral',
    },
    graphics: { graphicWeight: opts.graphicWeight ?? 'none', artworkType: 'none' },
    fabric: {
      pattern: 'solid',
      fabricWeight: opts.fabricWeight ?? 'medium',
      breathability: 'medium',
      season: 'allSeason',
      layerRole: 'base',
    },
    styleTags: [],
    fit: opts.fit ?? 'regular',
    formality: 3,
    statementStrength: 0.5,
    fabricName: opts.fabricName as FitItem['fabricName'],
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

// ─── S1: monochrome contract ─────────────────────────────────────────────────

Deno.test('monochrome: tight tonal look with texture variety outscores the formula-blind read', () => {
  // All-navy, lum range < 15, three distinct fabrics.
  const items = [
    fi('a', 'top', { lum: 30, fabricName: 'wool' }),
    fi('b', 'bottom', { lum: 34, fabricName: 'leather' }),
    fi('c', 'shoes', { lum: 26, fabricName: 'suede' }),
  ];
  const withContract = scoreColorHarmony(items, [], undefined, undefined, 'monochrome');
  const without = scoreColorHarmony(items, [], undefined, undefined);
  assert(withContract > without, `${withContract} should beat ${without}`);
});

Deno.test('monochrome: without texture variety the flat penalty stands', () => {
  const items = [
    fi('a', 'top', { lum: 30, fabricName: 'cotton' }),
    fi('b', 'bottom', { lum: 34, fabricName: 'cotton' }),
    fi('c', 'shoes', { lum: 26, fabricName: 'cotton' }),
  ];
  const withContract = scoreColorHarmony(items, [], undefined, undefined, 'monochrome');
  const without = scoreColorHarmony(items, [], undefined, undefined);
  assertEquals(withContract, without);
});

// ─── S1: flat-look veto waiver ───────────────────────────────────────────────

Deno.test('all-dark-muted with texture variety escapes the hard flat veto (0.85 vs 0.6)', () => {
  const textured = [
    fi('a', 'top', { lum: 20, sat: 10, fabricName: 'wool' }),
    fi('b', 'bottom', { lum: 25, sat: 15, fabricName: 'leather' }),
    fi('c', 'shoes', { lum: 15, sat: 10, fabricName: 'suede' }),
  ];
  const flat = [
    fi('a', 'top', { lum: 20, sat: 10, fabricName: 'jersey' }),
    fi('b', 'bottom', { lum: 25, sat: 15, fabricName: 'jersey' }),
    fi('c', 'shoes', { lum: 15, sat: 10, fabricName: 'jersey' }),
  ];
  assertEquals(scoreTasteAdjustment(textured).multiplier, 0.85);
  assertEquals(scoreTasteAdjustment(flat).multiplier, 0.6);
});

// ─── S1: texture_stack contract ──────────────────────────────────────────────

Deno.test('texture_stack: full light→heavy stack reads as deliberate depth', () => {
  const items = [
    fi('a', 'top', { fabricWeight: 'light' }),
    fi('b', 'bottom', { fabricWeight: 'medium' }),
    fi('c', 'outwear', { fabricWeight: 'heavy' }),
  ];
  const stacked = scoreTextureHarmony(items, 'texture_stack');
  const plain = scoreTextureHarmony(items);
  assert(stacked > plain, `${stacked} should beat ${plain}`);
});

// ─── S4: house POV ───────────────────────────────────────────────────────────

const mienLook = () => [
  fi('a', 'top', { primaryColor: 'cream', lum: 80, fabricName: 'cashmere', fit: 'regular' }),
  fi('b', 'bottom', { primaryColor: 'charcoal', lum: 25, fabricName: 'wool', fit: 'regular' }),
  fi('c', 'shoes', { primaryColor: 'charcoal', lum: 20, fabricName: 'leather', fit: 'regular' }),
];

Deno.test('house POV rewards a restrained natural-fabric look', () => {
  const delta = housePOVDelta(mienLook(), ['minimalist']);
  assert(delta > 0, `expected positive, got ${delta}`);
});

Deno.test('house POV penalises loud graphics', () => {
  const items = [
    fi('a', 'top', { graphicWeight: 'full_print', saturation: 'vivid', primaryColor: 'red' }),
    fi('b', 'bottom', { primaryColor: 'blue', saturation: 'vivid' }),
    fi('c', 'shoes', { primaryColor: 'white' }),
  ];
  assert(housePOVDelta(items, []) < 0);
});

Deno.test('opposed user styles halve the house voice', () => {
  const full = housePOVDelta(mienLook(), ['minimalist']);
  const halved = housePOVDelta(mienLook(), ['streetwear']);
  assertEquals(halved, full / 2);
});

Deno.test('house delta bounded within ±0.05', () => {
  for (const items of [mienLook(), [fi('x', 'top', { graphicWeight: 'full_print', saturation: 'vivid' }), fi('y', 'bottom', { saturation: 'vivid' }), fi('z', 'shoes', { saturation: 'vivid' })]]) {
    const d = housePOVDelta(items, []);
    assert(d >= -0.05 && d <= 0.05, `delta ${d} out of bounds`);
  }
});
