// Pure prompt-building helpers for describe-outfit, split out of index.ts so
// they're importable from a Deno test without triggering index.ts's
// module-level Deno.serve() call.

export interface OutfitItem {
  name?: string; type?: string; color?: string; material?: string; fit?: string;
}

// ─── Sole-torso-layer marker (2026-08-13) ─────────────────────────────────
// Mirrors generate-outfits/engine/curator.ts's isSoleTorsoLayer. Root cause
// (docs/redesign-outfit-completion.md:38, the "role-vocabulary gap"): "the
// vocabulary names the garment, never the function the garment is currently
// performing." describe-outfit's prompt named each garment by type but never
// said what role it was playing in THIS outfit, so the model saw "cardigan"
// and — cardigans being layering pieces by nature — suggested opening it,
// even on an outfit where the cardigan was the only thing on the torso.
//
// describe-outfit receives a flat item list from the client, not the
// engine's OutfitSlots, and can't import isSoleTorsoLayer directly — each
// Supabase Edge Function deploys its own directory in isolation (same reason
// src/components/outfit/collageLayout.ts keeps its own copy of the engine's
// LAYER_ROLE_BY_TYPE instead of importing it). So this derives the identical
// fact from data the client ALREADY sends — each item's `type` — rather than
// asking the client to send anything new: when exactly one item in the
// outfit is a torso-layer garment type, it is, by construction, the only
// thing on the torso (the outfit's bottoms/shoes/accessories don't occupy
// that region). Two or more such items means real layering is present and
// neither gets marked.
//
// Kept in sync BY HAND with LAYER_ROLE_BY_TYPE in generate-outfits/engine/
// enrichment.ts and OUTER_TOPS/MID_TOPS/INNER_TOPS in
// src/components/outfit/collageLayout.ts — same duplication tradeoff as
// those two already accept (documented at collageLayout.ts:30-39).
//
// The one-piece group (2026-08-21) is sourced from CATEGORY_MAP's `onepiece`
// group in generate-outfits/engine/enrichment.ts. Its absence was a second,
// more damaging divergence from the canonical isSoleTorsoLayer(slots) in
// generate-outfits/engine/curator.ts:32 (`slots.outwear === undefined &&
// slots.mid === undefined`): a dress worn alone counted 0 torso-layer items
// (never got the marker), and dress + blazer counted exactly 1 — the BLAZER
// — falsely marking IT the sole torso layer, which SUPPRESSES the "open it"
// suggestion (index.ts's system prompt bans suggesting that for a marked
// item). With a dress underneath, "open the blazer" is actually good advice
// — the false positive silently deleted it. Do not remove this group
// thinking one-pieces are irrelevant to a "layer" set.
const TORSO_LAYER_TYPES = new Set([
  // base — worn next to skin
  'TEE', 'CAMISOLE', 'HENLEY', 'BLOUSE', 'POLO', 'BODYSUIT', 'CROP', 'TUNIC', 'CORSET', 'SHIRT',
  // mid — insulation / depth between base and shell
  'SWEATER', 'KNIT', 'CARDIGAN', 'VEST', 'HOODIE', 'KIMONO',
  // outer — the shell
  'JACKET', 'BLAZER', 'COAT', 'PARKA', 'OVERCOAT', 'CAPE',
  // one-piece — occupies the torso by itself
  'DRESS', 'JUMPSUIT', 'OVERALLS', 'GOWN',
]);

export const SOLE_TORSO_LAYER_NOTE = 'sole torso layer';

/**
 * Index of the item that is the sole torso layer, or null when there isn't
 * exactly one (zero torso-layer garments present, or two-plus — meaning real
 * layering is happening and nothing should be singled out).
 */
export function deriveSoleTorsoLayerIndex(items: OutfitItem[]): number | null {
  const torsoIdxs: number[] = [];
  items.forEach((it, idx) => {
    if (TORSO_LAYER_TYPES.has((it.type ?? '').toUpperCase())) torsoIdxs.push(idx);
  });
  return torsoIdxs.length === 1 ? torsoIdxs[0] : null;
}

/**
 * Builds the numbered item-list block of the user turn, appending the
 * `sole torso layer` marker to that garment's line when applicable — right
 * next to the garment, the same shape generate-outfits/index.ts's `describe`
 * callback uses (an `extra` note inside the trailing attributes). Pure
 * function so it's testable without a network call.
 */
export function buildItemLines(items: OutfitItem[]): string {
  const soleTorsoIdx = deriveSoleTorsoLayerIndex(items);
  return items.map((i, n) => {
    const notes = [i.color, i.material, i.fit ? `${i.fit} fit` : null, n === soleTorsoIdx ? SOLE_TORSO_LAYER_NOTE : null]
      .filter(Boolean).join(', ');
    return `${n + 1}. ${i.name ?? i.type}${i.type && i.name ? ` (${i.type.toLowerCase()})` : ''}${notes ? ` — ${notes}` : ''}`;
  }).join('\n');
}
