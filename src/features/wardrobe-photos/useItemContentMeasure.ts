// useItemContentMeasure — resolve a single item's measured garment content
// bounds (see contentBounds.ts), for surfaces that render exactly one item's
// photo and want the tight-crop rect/aspect once it's available. Sibling to
// useItemPhoto.ts rather than baked into it: this measurement is layout-only
// (feeds the collage's aspect/crop), not part of "do we have a renderable
// image at all", so callers that don't need cropping never pay for it.
//
// Bundled catalog art (png require-asset, or an `asset:<key>` reference) is
// already tight-cropped — skipped, always resolves to null, no measurement
// ever runs for it.

import { useEffect, useState } from 'react';
import { contentBoundsFromUri } from './contentBoundsUri';
import type { ContentMeasure } from './contentBounds';
import { isAssetRef } from './assetMap';
import { photoSourceUri } from './photoSourceUri';
import type { PhotoInput, ResolvedPhoto } from './types';

function isBundledArt(photo: PhotoInput): boolean {
  return photo.png != null || isAssetRef(photo.photoPath);
}

export function useItemContentMeasure(photo: PhotoInput, resolved: ResolvedPhoto): ContentMeasure | null {
  const skip = isBundledArt(photo);
  const uri = !skip && resolved.status === 'ready' ? photoSourceUri(resolved.source) : null;
  const [measure, setMeasure] = useState<ContentMeasure | null>(null);

  useEffect(() => {
    if (!uri) {
      setMeasure(null);
      return;
    }
    let cancelled = false;
    contentBoundsFromUri(uri).then((m) => { if (!cancelled) setMeasure(m); });
    return () => { cancelled = true; };
  }, [uri]);

  return measure;
}
