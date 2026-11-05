// wishlistService — sole point of contact with the wishlist_items table and
// its photos ({user_id}/wishlist/{id}.png in the private wardrobe-photos bucket).

import * as FileSystem from 'expo-file-system/legacy';
import { sb } from './supabase';
import { optimizeImage, signedUrl } from './itemPhotoService';
import type { GarmentMetadata } from './imageGenerationService';
import type { Verdict } from '../types/tryOn';

const BUCKET = 'wardrobe-photos';

export type WishlistStatus = 'considering' | 'bought' | 'skipped';

export interface WishlistItem {
  id: string;
  metadata: GarmentMetadata;
  photoPath: string | null;
  price: number | null;
  sourceUrl: string | null;
  verdict: Verdict | null;
  verdictAt: string | null;
  wardrobeFp: string | null;
  status: WishlistStatus;
  createdAt: string;
}

interface WishlistRow {
  id: string;
  metadata: GarmentMetadata;
  photo_path: string | null;
  price: number | string | null;   // numeric comes back as string from PostgREST
  source_url: string | null;
  verdict: Verdict | null;
  verdict_at: string | null;
  wardrobe_fp: string | null;
  status: WishlistStatus;
  created_at: string;
}

export class WishlistError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WishlistError';
  }
}

/** Pure: `${count}:${latest updatedAt|createdAt}` — changes when the wardrobe does. */
export function wardrobeFingerprint(
  items: { createdAt: string; updatedAt?: string | null }[],
): string {
  let max = '';
  for (const i of items) {
    const ts = i.updatedAt ?? i.createdAt;
    if (ts > max) max = ts;
  }
  return `${items.length}:${max}`;
}

/** Pure: sum of prices of skipped items (null/0 -> 0). */
export function skippedTotal(items: { status: WishlistStatus; price: number | null }[]): number {
  return items.reduce((s, i) => (i.status === 'skipped' && i.price ? s + i.price : s), 0);
}

function rowToItem(r: WishlistRow): WishlistItem {
  return {
    id: r.id,
    metadata: r.metadata,
    photoPath: r.photo_path,
    price: r.price == null ? null : Number(r.price),
    sourceUrl: r.source_url,
    verdict: r.verdict,
    verdictAt: r.verdict_at,
    wardrobeFp: r.wardrobe_fp,
    status: r.status,
    createdAt: r.created_at,
  };
}

async function currentUserId(): Promise<string> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new WishlistError('Not authenticated');
  return user.id;
}

/** All non-bought items (considering + skipped), newest first. */
export async function listWishlist(): Promise<WishlistItem[]> {
  const userId = await currentUserId();
  const { data, error } = await sb.from('wishlist_items')
    .select('*').eq('user_id', userId).neq('status', 'bought')
    .order('created_at', { ascending: false });
  if (error) throw new WishlistError('Failed to load wishlist', error);
  return ((data ?? []) as WishlistRow[]).map(rowToItem);
}

export async function addWishlistItem(input: {
  metadata: GarmentMetadata;
  localImageUri: string | null;
  verdict: Verdict | null;
  wardrobeFp: string;
}): Promise<WishlistItem> {
  const userId = await currentUserId();
  const { data, error } = await sb.from('wishlist_items').insert({
    user_id: userId,
    metadata: input.metadata,
    verdict: input.verdict,
    verdict_at: input.verdict ? new Date().toISOString() : null,
    wardrobe_fp: input.verdict ? input.wardrobeFp : null,
  }).select('*').single();
  if (error || !data) throw new WishlistError('Failed to save to wishlist', error);
  let row = data as WishlistRow;

  // Photo is best-effort: the row is already saved; a failed upload leaves
  // photo_path null (the card falls back to a text placeholder).
  if (input.localImageUri) {
    try {
      const path = `${userId}/wishlist/${row.id}.png`;
      const opt = await optimizeImage(input.localImageUri, 'png');
      const b64 = await FileSystem.readAsStringAsync(opt.uri, { encoding: 'base64' });
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const up = await sb.storage.from(BUCKET)
        .upload(path, bytes, { contentType: 'image/png', upsert: true });
      if (!up.error) {
        const { data: upd } = await sb.from('wishlist_items')
          .update({ photo_path: path, updated_at: new Date().toISOString() })
          .eq('id', row.id).select('*').single();
        if (upd) row = upd as WishlistRow;
      }
    } catch (e) {
      console.warn('[wishlist] photo upload failed:', e);
    }
  }
  return rowToItem(row);
}

export async function updateWishlistVerdict(id: string, verdict: Verdict, wardrobeFp: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await sb.from('wishlist_items').update({
    verdict, verdict_at: now, wardrobe_fp: wardrobeFp, updated_at: now,
  }).eq('id', id);
  if (error) throw new WishlistError('Failed to update verdict', error);
}

export async function setWishlistStatus(id: string, status: WishlistStatus): Promise<void> {
  const { error } = await sb.from('wishlist_items')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new WishlistError('Failed to update status', error);
}

export async function setWishlistPrice(id: string, price: number | null): Promise<void> {
  const { error } = await sb.from('wishlist_items')
    .update({ price, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new WishlistError('Failed to update price', error);
}

/** Deletes the row and its storage object. */
export async function removeWishlistItem(item: Pick<WishlistItem, 'id' | 'photoPath'>): Promise<void> {
  const { error } = await sb.from('wishlist_items').delete().eq('id', item.id);
  if (error) throw new WishlistError('Failed to remove wishlist item', error);
  if (item.photoPath) {
    try { await sb.storage.from(BUCKET).remove([item.photoPath]); } catch { /* best-effort */ }
  }
}

/** Short-lived signed URL for a wishlist photo. */
export function wishlistPhotoUrl(photoPath: string): Promise<string> {
  return signedUrl(photoPath);
}

/** Download the photo to a temp file so the normal add-to-wardrobe path can take it. */
export async function downloadWishlistPhoto(item: Pick<WishlistItem, 'id' | 'photoPath'>): Promise<string | null> {
  if (!item.photoPath) return null;
  const url = await signedUrl(item.photoPath);
  const dest = `${FileSystem.cacheDirectory}wishlist-${item.id}.png`;
  const res = await FileSystem.downloadAsync(url, dest);
  return res.status === 200 ? res.uri : null;
}
