// Deno tests for deterministic styling tips (Way to Wear Phase B, 2026-07-03)
// + outerwear-as-anchor + favourite-item-as-hero (same batch).
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { deriveStylingTips } from './styling-tips.ts';
import { generateCandidates, generateHeroCandidates } from './generation.ts';
import { FitItem, ItemCategory } from './types.ts';

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    typeName?: string; formality?: number; statement?: number;
    fabricName?: FitItem['fabricName']; layerRole?: 'base' | 'mid' | 'outer';
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: { primaryColor: 'navy', colorLightness: 'dark', colorSaturation: 'muted', sat: 20, lum: 40, undertone: 'neutral' },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: {
      pattern: 'solid', fabricWeight: 'medium', breathability: 'medium',
      season: 'allSeason', layerRole: opts.layerRole ?? 'base',
    },
    styleTags: [],
    fit: 'regular',
    warmth: 2,
    formality: opts.formality ?? 2.5,
    statementStrength: opts.statement ?? 0.5,
    fabricName: opts.fabricName,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

// ─── styling tips ────────────────────────────────────────────────────────────

Deno.test('tuck tip fires for a tuckable top over a dressy bottom, in both locales', () => {
  const items = [
    fi('a', 'top', { typeName: 'SHIRT', formality: 3.5 }),
    fi('b', 'bottom', { typeName: 'TROUSERS', formality: 4.0 }),
    fi('c', 'shoes', { typeName: 'LOAFERS' }),
  ];
  const tips = deriveStylingTips(items, 'one_two_three');
  const tuck = tips.find(t => t.key === 'tuck');
  assert(tuck !== undefined);
  assert(tuck!.en.length > 0 && tuck!.vi.length > 0);
});

Deno.test('layer-open tip leads when a dual-role top occupies the outwear slot', () => {
  const items = [
    fi('tee', 'top', { typeName: 'TEE' }),
    fi('flannel', 'top', { typeName: 'SHIRT' }),
    fi('b', 'bottom', { typeName: 'JEANS' }),
    fi('s', 'shoes', { typeName: 'SNEAKERS' }),
  ];
  const tips = deriveStylingTips(items, 'rule_of_thirds', { top: 'tee', outwear: 'flannel' });
  assertEquals(tips[0]?.key, 'layer_open');
});

Deno.test('monochrome formula speaks about texture', () => {
  const items = [fi('a', 'top'), fi('b', 'bottom'), fi('c', 'shoes')];
  const tips = deriveStylingTips(items, 'monochrome');
  assert(tips.some(t => t.key === 'mono_texture'));
});

Deno.test('tips are deterministic and capped at 2', () => {
  const items = [
    fi('a', 'top', { typeName: 'SHIRT', formality: 3.5 }),
    fi('b', 'bottom', { typeName: 'JEANS', formality: 2.0 }),
    fi('c', 'shoes', { typeName: 'LOAFERS' }),
  ];
  const t1 = deriveStylingTips(items, 'monochrome');
  const t2 = deriveStylingTips(items, 'monochrome');
  assertEquals(JSON.stringify(t1), JSON.stringify(t2));
  assert(t1.length <= 2);
});

// ─── outerwear as anchor in formula pools ────────────────────────────────────

Deno.test('a statement coat anchors its pool: first candidate carries it in the outwear slot', () => {
  const wardrobe = [
    fi('coat-hero', 'outwear', { typeName: 'COAT', statement: 3.0, layerRole: 'outer' }),
    fi('tee', 'top', { typeName: 'TEE', statement: 0.3 }),
    fi('jeans', 'bottom', { typeName: 'JEANS', statement: 0.3 }),
    fi('sneakers', 'shoes', { typeName: 'SNEAKERS', statement: 0.3 }),
  ];
  const candidates = generateCandidates(
    wardrobe,
    ['layering_stack'] as Parameters<typeof generateCandidates>[1],
    'seed-coat',
  );
  assert(candidates.length > 0);
  assertEquals(candidates[0].slots.outwear, 'coat-hero');
});

// ─── favourite item as hero ──────────────────────────────────────────────────

Deno.test('a saved/worn favourite outranks an equally loud piece for hero selection', () => {
  const items = [
    fi('a-top', 'top', { typeName: 'TEE', statement: 2.0 }),
    fi('fav-top', 'top', { typeName: 'SHIRT', statement: 2.0 }),
    fi('b', 'bottom', { typeName: 'JEANS' }),
    fi('s', 'shoes', { typeName: 'SNEAKERS' }),
  ];
  // Without favourites the id tie-break puts a-top first.
  const plain = generateHeroCandidates(items, 'seed-fav', []);
  assertEquals(plain[0]?.slots.top, 'a-top');
  // With fav-top in the favourite set, it leads instead.
  const withFav = generateHeroCandidates(items, 'seed-fav', [], new Set(['fav-top']));
  assertEquals(withFav[0]?.slots.top, 'fav-top');
});
