import { useAppStore } from '../../stores/appStore';
import { formatStatValue } from './profileStatsFormat';

export { formatStatValue };

export interface ProfileStats {
  itemCount: number;
  savedOutfitCount: number;
  collectionCount: number;
}

/**
 * Real, per-user profile stats — no mock/demo data mixed in.
 *
 * - itemCount: the user's actual wardrobe (`wardrobeItems`, Supabase-backed
 *   via fetchMyItems). No fallback to the seeded demo catalogue (`items`) —
 *   a brand-new wardrobe reads as 0, never a borrowed mock count.
 * - savedOutfitCount: outfits the user has saved, from `savedSet`
 *   (hydrated from the `outfit_interactions` table, type 'saved' — see
 *   loadServerState in appStore.ts). This replaces the old `OUTFITS.length`,
 *   which was a hardcoded constant from the static demo catalogue and
 *   showed the exact same number for every user regardless of activity.
 * - collectionCount: `collections`, Supabase-backed via fetchMyCollections.
 *   Falls back to a small seeded demo list only as a transient placeholder
 *   before hydration/auth resolves — already real per-user data once loaded,
 *   unchanged here.
 */
export function useProfileStats(): ProfileStats {
  const itemCount = useAppStore(s => s.wardrobeItems.length);
  const savedOutfitCount = useAppStore(s => s.savedSet.size);
  const collectionCount = useAppStore(s => s.collections.length);
  return { itemCount, savedOutfitCount, collectionCount };
}
