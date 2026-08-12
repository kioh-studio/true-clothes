// Manual outfit builder (app/build.tsx) — bucket catalog.
//
// Maps a wardrobe item's granular `type` to the builder's display bucket.
// assignBucketKey (toBuilderItem.ts) is total: every item lands in exactly
// one bucket, even when its type isn't listed in any entry below — those
// fall through to BUILDER_FALLBACK_BUCKET rather than vanishing from the
// picker.
//
// Moved out of app/build.tsx (2026-08-11) so it's plain-Jest testable (jest
// roots only cover src/, not app/ — see jest.config.js) and so the fallback
// bucket's name can be asserted directly. Previously the fallback bucket was
// named 'BAGS' (types: ['BAG']), so any item whose type isn't recognized —
// e.g. headwear (CAP/HAT), belts, scarves, ties, sunglasses — landed in a
// strip visibly labeled "BAGS", which reads as a mislabel to the user. Kept
// the catch-all (an item must never disappear) but renamed it 'ACCESSORIES':
// a bag IS an accessory, so folding the mislabeled overflow into a correctly
// -named accessories group fixes every wrongly-bucketed type in one rename,
// without inventing a second near-empty bucket per accessory type.
export const BUILDER_BUCKETS = [
  { key: 'TOPS',        types: ['TEE', 'KNIT', 'POLO', 'SHIRT', 'BLOUSE', 'HENLEY', 'SWEATER', 'CARDIGAN', 'VEST', 'CAMISOLE', 'CROP', 'BODYSUIT', 'TUNIC', 'CORSET'] },
  { key: 'BOTTOMS',     types: ['JEANS', 'TROUSERS', 'CHINOS', 'SHORTS', 'SKIRT', 'LEGGINGS'] },
  { key: 'DRESS',       types: ['DRESS', 'JUMPSUIT', 'OVERALLS', 'GOWN'] },
  { key: 'OUTERWEAR',   types: ['JACKET', 'BLAZER', 'COAT', 'OVERCOAT', 'HOODIE', 'PARKA', 'CAPE', 'KIMONO'] },
  { key: 'SHOES',       types: ['LOAFERS', 'SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'OXFORDS', 'MULES', 'FLATS', 'WEDGES', 'SLIDES'] },
  { key: 'ACCESSORIES', types: ['BAG'] },
] as const;

export type BuilderBucketKey = typeof BUILDER_BUCKETS[number]['key'];

/** The catch-all bucket assignBucketKey falls back to for any type not
 *  listed above — headwear (CAP/HAT) included. */
export const BUILDER_FALLBACK_BUCKET: BuilderBucketKey = 'ACCESSORIES';

// Bucket keys above are stable internal ids (Selection type keys, pool
// lookups) — this maps each to its translated display label, same pattern as
// the FILTER_LABEL_KEYS / SHAPE_LABEL_KEYS maps elsewhere in the app.
export const BUCKET_LABEL_KEYS: Record<BuilderBucketKey, string> = {
  TOPS: 'build_bucketTops',
  BOTTOMS: 'build_bucketBottoms',
  DRESS: 'build_bucketDress',
  OUTERWEAR: 'build_bucketOuterwear',
  SHOES: 'build_bucketShoes',
  ACCESSORIES: 'build_bucketAccessories',
};
