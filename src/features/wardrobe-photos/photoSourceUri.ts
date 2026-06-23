// Extract a plain string uri from a resolved photo source (useItemPhoto).
// Wardrobe items resolve to `{ uri }`; bundled demo assets resolve to a require()
// number (no uri). Returns null when there's no string uri to render.
import type { ImageSourcePropType } from 'react-native';

export function photoSourceUri(source: ImageSourcePropType | null | undefined): string | null {
  if (source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source) {
    const { uri } = source as { uri?: unknown };
    return typeof uri === 'string' ? uri : null;
  }
  return null;
}
