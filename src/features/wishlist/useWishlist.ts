// Wishlist hooks — list state (grid screen) and single-item state with the
// lazy re-evaluation + bought/skip/remove actions (detail screen).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import {
  WishlistItem, listWishlist, updateWishlistVerdict, setWishlistStatus,
  setWishlistPrice, removeWishlistItem, wishlistPhotoUrl, downloadWishlistPhoto,
  wardrobeFingerprint, skippedTotal,
} from '../../services/wishlistService';
import { evaluateItem } from '../../services/tryOnService';
import { scannedItemToAddInput } from '../try-on/scannedItemToAddInput';
import { useAppStore } from '../../stores/appStore';
import type { ScannedItem, Verdict } from '../../types/tryOn';
import i18n from '../../i18n';

/** Short-lived signed URL for a wishlist photo path (null while loading / none). */
export function useWishlistPhoto(photoPath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (photoPath) wishlistPhotoUrl(photoPath).then(u => { if (live) setUrl(u); }).catch(() => {});
    return () => { live = false; };
  }, [photoPath]);
  return url;
}

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listWishlist());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return {
    items,
    considering: items.filter(i => i.status === 'considering'),
    skippedSum: skippedTotal(items),
    loading,
    error,
  };
}

function toScanned(item: WishlistItem, localImageUri: string | null): ScannedItem {
  return { id: 'wishlist', localImageUri, metadata: item.metadata, method: 'ai', usedFallback: false };
}

export function useWishlistItem(id: string) {
  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const [item, setItem] = useState<WishlistItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Score change from the last re-evaluation, e.g. { from: 72, to: 64 }. */
  const [delta, setDelta] = useState<{ from: number | null; to: number | null } | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    let live = true;
    listWishlist()
      .then(list => { if (live) setItem(list.find(i => i.id === id) ?? null); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  // Open => compare fingerprints; re-run the verdict only when the wardrobe changed.
  useEffect(() => {
    if (!item || item.status !== 'considering' || checked.current) return;
    checked.current = true;
    const fp = wardrobeFingerprint(wardrobeItems);
    if (item.verdict && item.wardrobeFp === fp) return;
    setRefreshing(true);
    const locale = i18n.language?.startsWith('vi') ? 'vi' : 'en';
    evaluateItem(toScanned(item, null), locale, { skipNote: true })
      .then(async (verdict: Verdict) => {
        await updateWishlistVerdict(item.id, verdict, fp);
        if (item.verdict) setDelta({ from: item.verdict.overallScore, to: verdict.overallScore });
        setItem(cur => cur && { ...cur, verdict, wardrobeFp: fp, verdictAt: new Date().toISOString() });
      })
      .catch(() => { /* keep the stored verdict; refresh is best-effort */ })
      .finally(() => setRefreshing(false));
  }, [item, wardrobeItems]);

  const setPrice = useCallback(async (price: number | null) => {
    if (!item) return;
    setItem({ ...item, price });
    try { await setWishlistPrice(item.id, price); } catch { /* keep local value */ }
  }, [item]);

  const skip = useCallback(async (): Promise<boolean> => {
    if (!item) return false;
    setBusy(true);
    try { await setWishlistStatus(item.id, 'skipped'); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { setBusy(false); }
  }, [item]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!item) return false;
    setBusy(true);
    try { await removeWishlistItem(item); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { setBusy(false); }
  }, [item]);

  /** Add to wardrobe via the normal path, then drop the wishlist row. */
  const markBought = useCallback(async (): Promise<boolean> => {
    if (!item) return false;
    setBusy(true);
    setError(null);
    let tmp: string | null = null;
    try {
      tmp = await downloadWishlistPhoto(item).catch(() => null);
      await useAppStore.getState().addWardrobeItem(scannedItemToAddInput(toScanned(item, tmp)));
      const err = useAppStore.getState().wardrobeError;
      if (err) { setError(err); return false; }
      await removeWishlistItem(item);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      if (tmp) FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
      setBusy(false);
    }
  }, [item]);

  return { item, loading, refreshing, busy, error, delta, setPrice, skip, remove, markBought };
}
