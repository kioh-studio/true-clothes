// uri → measured garment content bounds, for the "real wardrobe photo lays
// out tiny inside its collage box" fix (2026-08-12). Kept in its own file so
// the pure algorithm in contentBounds.ts stays importable from Jest without
// native/Expo deps — same split as colorClusterUri.ts / colorCluster.ts.
//
// Pipeline (identical downscale/decode pattern to colorClusterUri.ts):
// expo-image-manipulator downscale (~64px long side) → base64 JPEG →
// jpeg-js decode to RGBA → measureContentBounds. JPEG has no alpha channel,
// so a transparent cut-out's background flattens to a solid fill on
// re-encode; the border-median background estimate in measureContentBounds
// handles whatever solid colour that flattening produces, whether it's
// white, black, or anything else.
//
// Never throws: any manipulate/decode/measure failure resolves to null so
// callers can always fall back to the un-cropped, `resizeMode="contain"`
// rendering path.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { measureContentBounds, type ContentMeasure } from './contentBounds';

// base64 JPEG → RGBA (same decode helper as colorClusterUri.ts — duplicated
// rather than imported across features, per that file's own convention).
function decodeJpeg(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64); // Hermes provides atob on Expo 54
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

// Session-only cache — each photo is measured at most once per app session.
// Feed cards remount constantly as the pager scrolls, so this is the
// difference between one ~tens-of-ms measurement per photo and dozens.
// No MMKV/persistence: cheap enough to redo cold on the next launch.
const cache = new Map<string, Promise<ContentMeasure | null>>();

async function measure(uri: string): Promise<ContentMeasure | null> {
  try {
    // Only width given → the manipulator preserves aspect ratio.
    const res = await manipulateAsync(uri, [{ resize: { width: 64 } }], {
      base64: true, compress: 0.9, format: SaveFormat.JPEG,
    });
    if (!res.base64) return null;
    const img = decodeJpeg(res.base64);
    return measureContentBounds(img.data, img.width, img.height);
  } catch {
    return null;
  }
}

export async function contentBoundsFromUri(uri: string): Promise<ContentMeasure | null> {
  if (!uri) return null;
  const cached = cache.get(uri);
  if (cached) return cached;
  const promise = measure(uri);
  cache.set(uri, promise);
  return promise;
}
