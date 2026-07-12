// uri → dominant hex wrapper for the pure colorCluster.ts (measured-hex color
// layer, 2026-07-06). Kept in its own file so the pure algorithm stays
// importable from Jest without native/Expo deps.
//
// Pipeline (same on-device pattern as personal-color's analyzePhoto.ts):
// expo-image-manipulator downscale (~64px long side — plenty for a dominant-
// colour read, keeps decode cheap) → base64 JPEG → jpeg-js decode to RGBA →
// dominantHexes. JPEG has no alpha channel, so a transparent cut-out's
// background flattens to a solid fill during re-encode; the near-white /
// near-black sample filters inside dominantHexes are what actually drop it —
// same reason the server-side variant survives unkeyed white-bg images.
//
// Never throws: any manipulate/decode failure resolves to nulls so ingest can
// treat hex as best-effort and never block an add.

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { dominantHexes, DominantHexes } from './colorCluster';

const NULLS: DominantHexes = { primaryHex: null, secondaryHex: null };

// base64 JPEG → RGBA (same decode helper pattern as analyzePhoto.ts).
function decodeJpeg(base64: string): { width: number; height: number; data: Uint8Array } {
  const bin = atob(base64); // Hermes provides atob on Expo 54
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // useTArray → return a Uint8Array (RN has no Node Buffer)
  return jpeg.decode(bytes, { useTArray: true }) as { width: number; height: number; data: Uint8Array };
}

export async function dominantHexesFromUri(uri: string): Promise<DominantHexes> {
  if (!uri) return NULLS;
  try {
    // Only width given → the manipulator preserves aspect ratio.
    const res = await manipulateAsync(uri, [{ resize: { width: 64 } }], {
      base64: true, compress: 0.9, format: SaveFormat.JPEG,
    });
    if (!res.base64) return NULLS;
    const img = decodeJpeg(res.base64);
    return dominantHexes(img.data, img.width, img.height);
  } catch {
    return NULLS;
  }
}
