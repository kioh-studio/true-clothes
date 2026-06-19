// useItemPhoto — unified "resolve an item to a renderable image source" hook
// (feature 003-upload-image). One code path for free (on-device), premium
// (cloud + device cache), and bundled demo items, with a graceful `missing`
// state so no surface ever shows a broken image (FR-005/008a/009).

import { useEffect, useState } from 'react';
import { resolveDeviceUri, ensureCloudCached } from '../../services/itemPhotoService';
import { isAssetRef, resolveAssetRef } from './assetMap';
import type { PhotoInput, ResolvedPhoto } from './types';

export type { PhotoStatus } from './types';

/** Synchronous best-guess state used to seed the hook before async resolution. */
export function initialPhotoState(item: PhotoInput): ResolvedPhoto {
  if (item.png != null) return { source: item.png, status: 'ready' };
  if (!item.photoPath) return { source: null, status: 'missing' };
  if (isAssetRef(item.photoPath)) {
    const mod = resolveAssetRef(item.photoPath);
    return mod != null ? { source: mod, status: 'ready' } : { source: null, status: 'missing' };
  }
  if (item.photoStorage === 'none') return { source: null, status: 'missing' };
  if (/^https?:\/\//.test(item.photoPath)) return { source: { uri: item.photoPath }, status: 'ready' };
  return { source: null, status: 'loading' };
}

/** Pure async resolver — testable without a React renderer (T033). */
export async function resolveItemPhotoSource(item: PhotoInput): Promise<ResolvedPhoto> {
  if (item.png != null) return { source: item.png, status: 'ready' };
  if (!item.photoPath) return { source: null, status: 'missing' };

  // Bundled-asset reference (`asset:<key>`) — render the in-app catalog image.
  if (isAssetRef(item.photoPath)) {
    const mod = resolveAssetRef(item.photoPath);
    return mod != null ? { source: mod, status: 'ready' } : { source: null, status: 'missing' };
  }

  if (item.photoStorage === 'none') return { source: null, status: 'missing' };

  // Direct remote URL (e.g. retailer product image seeded into photo_url) — render
  // as-is, never sign it as a bucket path. Keeps pre-existing seeded items working.
  if (/^https?:\/\//.test(item.photoPath)) {
    return { source: { uri: item.photoPath }, status: 'ready' };
  }

  try {
    if (item.photoStorage === 'local') {
      const uri = await resolveDeviceUri(item.photoPath);
      return uri ? { source: { uri }, status: 'ready' } : { source: null, status: 'missing' };
    }
    // cloud: serve from device cache, else fetch+download (offline → missing)
    const uri = await ensureCloudCached(item.id, item.photoPath);
    return { source: { uri }, status: 'ready' };
  } catch {
    return { source: null, status: 'missing' };
  }
}

export function useItemPhoto(item: PhotoInput): ResolvedPhoto {
  const { id, png, photoStorage, photoPath } = item;
  const [state, setState] = useState<ResolvedPhoto>(() => initialPhotoState(item));

  useEffect(() => {
    let cancelled = false;
    setState(initialPhotoState(item));
    resolveItemPhotoSource(item).then((next) => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
    // Resolve on the identity-bearing primitives only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, png, photoStorage, photoPath]);

  return state;
}
