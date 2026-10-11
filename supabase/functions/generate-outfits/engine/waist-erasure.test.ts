// Run: deno test supabase/functions/generate-outfits/engine/
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { waistErasureMultiplier } from './scoring.ts';
import { BodyShape, FitItem, ItemCategory, ItemFit } from './types.ts';

function fi(
  id: string,
  category: ItemCategory,
  fit: ItemFit,
  opts: { typeName?: string; drape?: 'structured' | 'regular' | 'fluid' } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: { primaryColor: 'navy', colorLightness: 'dark', colorSaturation: 'muted', sat: 20, lum: 40, undertone: 'cool' },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    styleTags: [],
    fit,
    formality: 3,
    statementStrength: 0.5,
    drape: opts.drape,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

const cardi = () => fi('t', 'top', 'oversized', { typeName: 'CARDIGAN' });
const wideTrousers = () => fi('b', 'bottom', 'wide', { typeName: 'TROUSERS' });
const slimTee = () => fi('t', 'top', 'slim');
const shoes = () => fi('s', 'shoes', 'regular', { typeName: 'SNEAKERS' });
const m = (items: FitItem[], shape?: BodyShape) => waistErasureMultiplier([...items, shoes()], shape);
const near = (a: number, b: number) => assertEquals(Math.abs(a - b) < 1e-9, true, `${a} != ${b}`);

Deno.test('oversized cardigan + wide trousers, hourglass -> 0.75', () => {
  near(m([cardi(), wideTrousers()], 'hourglass'), 0.75);
});
Deno.test('belt rescues the waist', () => {
  near(m([cardi(), wideTrousers(), fi('belt', 'accessory', 'regular', { typeName: 'BELT' })], 'hourglass'), 1);
});
Deno.test('regular blazer rescues; oversized blazer does not', () => {
  near(m([cardi(), wideTrousers(), fi('o', 'outwear', 'regular', { typeName: 'BLAZER' })], 'hourglass'), 1);
  near(m([cardi(), wideTrousers(), fi('o', 'outwear', 'oversized', { typeName: 'BLAZER' })], 'hourglass'), 0.75);
});
Deno.test('slim tee + wide trousers -> 1; relaxed + wide -> 1', () => {
  near(m([slimTee(), wideTrousers()], 'hourglass'), 1);
  near(m([fi('t', 'top', 'relaxed'), wideTrousers()], 'hourglass'), 1);
});
Deno.test('fluid regular blouse + fluid regular skirt, hourglass -> 0.75', () => {
  near(m([fi('t', 'top', 'regular', { drape: 'fluid' }), fi('b', 'bottom', 'regular', { typeName: 'SKIRT', drape: 'fluid' })], 'hourglass'), 0.75);
});
Deno.test('fluid + fluid AND wide + wide, hourglass -> 0.65', () => {
  near(m([fi('t', 'top', 'wide', { drape: 'fluid' }), fi('b', 'bottom', 'wide', { drape: 'fluid' })], 'hourglass'), 0.65);
});
Deno.test('shape tiers: undefined / rectangle 0.92, triangle 0.85', () => {
  const o = () => [fi('t', 'top', 'wide'), wideTrousers()];
  near(m(o(), undefined), 0.92);
  near(m(o(), 'rectangle'), 0.92);
  near(m(o(), 'triangle'), 0.85);
});
Deno.test('drape undefined + regular fits -> 1', () => {
  near(m([fi('t', 'top', 'regular'), fi('b', 'bottom', 'regular')], 'hourglass'), 1);
});
Deno.test('no bottom -> 1', () => {
  near(m([cardi()], 'hourglass'), 1);
});
Deno.test('wide outwear coat + slim tee + wide trousers -> 1 (outerwear is not a top)', () => {
  near(m([fi('o', 'outwear', 'wide', { typeName: 'COAT' }), slimTee(), wideTrousers()], 'hourglass'), 1);
});
Deno.test('wide fluid dress alone counts on both sides', () => {
  near(m([fi('d', 'onepiece', 'wide', { typeName: 'DRESS', drape: 'fluid' })], 'hourglass'), 0.65);
});
