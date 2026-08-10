// Manual outfit builder (app/build.tsx) — real-wardrobe adapter.
export { useBuilderItems } from './useBuilderItems';
export {
  toBuilderItem, builderTypeOf, builderNameOf, builderColorOf, assignBucketKey,
} from './toBuilderItem';
export type { BuilderItem } from './toBuilderItem';
export { BUILDER_BUCKETS, BUILDER_FALLBACK_BUCKET, BUCKET_LABEL_KEYS } from './buckets';
export type { BuilderBucketKey } from './buckets';
