// useAvatarUri — resolves profiles.avatar_path (a private `avatars` bucket
// object path) to a short-lived signed URL at render time. Mirrors
// useItemPhoto's render-time-signing pattern for wardrobe-photos
// (src/features/wardrobe-photos/useItemPhoto.ts + itemPhotoService.signedUrl).
//
// The DB only ever stores the object PATH (2026-08-11 security fix — the
// bucket is private, so a persisted public/signed URL either 400s or goes
// stale). Nothing is cached to disk here (avatars are small and infrequent,
// unlike wardrobe photos) — every mount/path-change re-signs.

import { useEffect, useState } from 'react';
import { avatarSignedUrl } from '../../services/profileService';

/** Returns a renderable signed URL for `avatarPath`, or null while unset/loading. */
export function useAvatarUri(avatarPath: string | null): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) {
      setUri(null);
      return;
    }
    avatarSignedUrl(avatarPath).then((signed) => {
      if (!cancelled) setUri(signed);
    });
    return () => { cancelled = true; };
  }, [avatarPath]);

  return uri;
}
