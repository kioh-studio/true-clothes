// Manual outfit builder (app/build.tsx) bucket catalog — see buckets.ts for
// the full "why" (headwear used to render inside a strip labeled "BAGS").
//
// This exercises the REAL BUILDER_BUCKETS/BUILDER_FALLBACK_BUCKET the screen
// renders with (not a toy fixture), through the same total assignBucketKey
// function toBuilderItem.test.ts already covers generically.

import { assignBucketKey } from '../toBuilderItem';
import { BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET, BUCKET_LABEL_KEYS, type BuilderBucketKey } from '../buckets';

describe('BUILDER_BUCKETS / BUILDER_FALLBACK_BUCKET', () => {
  it('fallback bucket is no longer named BAGS', () => {
    expect(BUILDER_FALLBACK_BUCKET).toBe('ACCESSORIES');
    expect(BUILDER_BUCKETS.some((b) => (b.key as string) === 'BAGS')).toBe(false);
  });

  it.each(['CAP', 'HAT'])('headwear type %s lands in the ACCESSORIES bucket, not a bag-only bucket', (type) => {
    const key = assignBucketKey<BuilderBucketKey>(type, BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET);
    expect(key).toBe('ACCESSORIES');
  });

  it('is case-insensitive for headwear types', () => {
    expect(assignBucketKey<BuilderBucketKey>('cap', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('ACCESSORIES');
  });

  it('still buckets an actual bag into ACCESSORIES (its listed type, not just the fallback)', () => {
    expect(assignBucketKey<BuilderBucketKey>('BAG', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('ACCESSORIES');
  });

  it.each(['BELT', 'SCARF', 'TIE', 'SUNGLASSES', 'RING', 'BRACELET'])(
    'other unlisted accessory type %s still resolves to ACCESSORIES, never dropped',
    (type) => {
      expect(assignBucketKey<BuilderBucketKey>(type, BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('ACCESSORIES');
    },
  );

  it('a completely unknown/future type still resolves to the fallback bucket (totality)', () => {
    expect(assignBucketKey<BuilderBucketKey>('SOME_NEW_TYPE_NOBODY_HAS_SEEN', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET))
      .toBe(BUILDER_FALLBACK_BUCKET);
  });

  it('every real garment/shoe/outerwear type still lands in its own dedicated bucket, unaffected by the rename', () => {
    expect(assignBucketKey<BuilderBucketKey>('SWEATER', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('TOPS');
    expect(assignBucketKey<BuilderBucketKey>('JEANS', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('BOTTOMS');
    expect(assignBucketKey<BuilderBucketKey>('DRESS', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('DRESS');
    expect(assignBucketKey<BuilderBucketKey>('JACKET', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('OUTERWEAR');
    expect(assignBucketKey<BuilderBucketKey>('SNEAKERS', BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET)).toBe('SHOES');
  });

  it('BUCKET_LABEL_KEYS has exactly one translation key per bucket, including the renamed one', () => {
    const bucketKeys = BUILDER_BUCKETS.map((b) => b.key);
    expect(Object.keys(BUCKET_LABEL_KEYS).sort()).toEqual([...bucketKeys].sort());
    expect(BUCKET_LABEL_KEYS.ACCESSORIES).toBe('build_bucketAccessories');
  });
});
