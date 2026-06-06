// wardrobeService — sole point of contact with clothing_items table and
// wardrobe-photos storage bucket. Screens and stores MUST NOT import `sb` directly.

import * as FileSystem from 'expo-file-system';
import { sb } from './supabase';
import { WardrobeItem } from '../types/fitEngine';

// ─── Error Types ─────────────────────────────────────────────────────────────

export class WardrobeStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WardrobeStorageError';
  }
}

export class WardrobeDbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WardrobeDbError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface AddItemInput {
  localPhotoUri: string | null;
  category: WardrobeItem['category'];
  colors: string[];
  sizeLabel?: string;
  brand?: string;
  notes?: string;
}

export interface UpdateItemInput {
  colors?: string[];
  sizeLabel?: string;
  brand?: string;
  notes?: string;
}

// ─── Legacy type (pre-sync AsyncStorage items) ───────────────────────────────

export interface LegacyLocalItem {
  id: string;
  type: string;
  name: string;
  color: string;
  category?: WardrobeItem['category'];
  localPhotoUri?: string;
  brand?: string;
  size?: string;
  notes?: string;
}

// ─── Internal DB row type (never exported) ────────────────────────────────────

interface ClothingItemRow {
  id: string;
  user_id: string;
  photo_url: string | null;
  photo_path: string | null;
  category: string;
  colors: string[];
  size_label: string | null;
  brand: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Row → domain mapper ──────────────────────────────────────────────────────

async function rowToItem(row: ClothingItemRow): Promise<WardrobeItem> {
  let photoUrl = row.photo_url;
  if (row.photo_path) {
    const { data } = await sb.storage
      .from('wardrobe-photos')
      .createSignedUrl(row.photo_path, 3600);
    if (data?.signedUrl) photoUrl = data.signedUrl;
  }
  return {
    id: row.id,
    userId: row.user_id,
    photoUrl,
    photoPath: row.photo_path,
    category: row.category as WardrobeItem['category'],
    colors: row.colors,
    sizeLabel: row.size_label,
    brand: row.brand,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all clothing items for the authenticated user, ordered by created_at DESC.
 * Returns empty array if no items. Throws WardrobeDbError on query failure.
 */
export async function fetchMyItems(): Promise<WardrobeItem[]> {
  const { data, error } = await sb
    .from('clothing_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new WardrobeDbError('Failed to fetch wardrobe items', error);
  if (!data || data.length === 0) return [];

  return Promise.all((data as ClothingItemRow[]).map(rowToItem));
}

/**
 * Add a new clothing item.
 * 1. Uploads photo to Storage (if localPhotoUri provided).
 * 2. Inserts row to clothing_items.
 * 3. Returns the created WardrobeItem with signed URL.
 *
 * Throws WardrobeStorageError if upload fails (no DB row inserted).
 * Throws WardrobeDbError if insert fails (attempts Storage cleanup).
 */
export async function addItem(input: AddItemInput): Promise<WardrobeItem> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new WardrobeDbError('Not authenticated');

  const itemId = crypto.randomUUID();
  let photoPath: string | null = null;

  if (input.localPhotoUri) {
    photoPath = `${user.id}/${itemId}.jpg`;
    const fileInfo = await FileSystem.getInfoAsync(input.localPhotoUri);
    if (!fileInfo.exists) throw new WardrobeStorageError('Photo file not found');

    const base64 = await FileSystem.readAsStringAsync(input.localPhotoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const blob = base64ToBlob(base64, 'image/jpeg');

    const { error: uploadError } = await sb.storage
      .from('wardrobe-photos')
      .upload(photoPath, blob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      throw new WardrobeStorageError('Photo upload failed', uploadError);
    }
  }

  const row = {
    id: itemId,
    user_id: user.id,
    photo_url: null as string | null,
    photo_path: photoPath,
    category: input.category,
    colors: input.colors,
    size_label: input.sizeLabel ?? null,
    brand: input.brand ?? null,
    notes: input.notes ?? null,
  };

  const { data, error: dbError } = await sb
    .from('clothing_items')
    .insert(row)
    .select()
    .single();

  if (dbError) {
    // Best-effort Storage cleanup
    if (photoPath) {
      sb.storage.from('wardrobe-photos').remove([photoPath]).catch(err =>
        console.warn('[wardrobeService] Storage cleanup failed after DB error:', err)
      );
    }
    throw new WardrobeDbError('Failed to save clothing item', dbError);
  }

  return rowToItem(data as ClothingItemRow);
}

/**
 * Update metadata for an existing item (colors, sizeLabel, brand, notes).
 * Does NOT update the photo. Throws WardrobeDbError if not found or update fails.
 */
export async function updateItem(id: string, patch: UpdateItemInput): Promise<WardrobeItem> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.colors !== undefined)    dbPatch.colors     = patch.colors;
  if (patch.sizeLabel !== undefined) dbPatch.size_label = patch.sizeLabel;
  if (patch.brand !== undefined)     dbPatch.brand      = patch.brand;
  if (patch.notes !== undefined)     dbPatch.notes      = patch.notes;

  const { data, error } = await sb
    .from('clothing_items')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new WardrobeDbError('Failed to update clothing item', error);
  return rowToItem(data as ClothingItemRow);
}

/**
 * Delete a clothing item.
 * 1. Deletes DB row (RLS enforces ownership).
 * 2. Attempts Storage deletion — failure is logged but never thrown.
 */
export async function deleteItem(id: string): Promise<void> {
  const { data, error } = await sb
    .from('clothing_items')
    .delete()
    .eq('id', id)
    .select('photo_path')
    .single();

  if (error) throw new WardrobeDbError('Failed to delete clothing item', error);

  const photoPath = (data as { photo_path: string | null })?.photo_path;
  if (photoPath) {
    sb.storage.from('wardrobe-photos').remove([photoPath]).catch(err =>
      console.warn('[wardrobeService] Storage delete failed (orphaned file):', err)
    );
  }
}

/**
 * Migrate legacy AsyncStorage items to Supabase.
 * Processes items sequentially. Calls onProgress after each regardless of success.
 * Returns only successfully migrated items.
 */
export async function migrateLocalItems(
  localItems: LegacyLocalItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<WardrobeItem[]> {
  const total = localItems.length;
  const migrated: WardrobeItem[] = [];

  for (let i = 0; i < localItems.length; i++) {
    const legacy = localItems[i];
    try {
      const item = await addItem({
        localPhotoUri: legacy.localPhotoUri ?? null,
        category: legacy.category ?? inferCategory(legacy.type),
        colors: [legacy.color],
        sizeLabel: legacy.size,
        brand: legacy.brand,
        notes: legacy.notes,
      });
      migrated.push(item);
    } catch (err) {
      console.warn(`[wardrobeService] Migration failed for item ${legacy.id}:`, err);
    }
    onProgress?.(i + 1, total);
  }

  return migrated;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferCategory(type: string): WardrobeItem['category'] {
  const t = type.toUpperCase();
  if (['TEE', 'POLO', 'SHIRT', 'KNIT', 'SWEATER'].includes(t)) return 'top';
  if (['JEANS', 'CHINOS', 'TROUSERS', 'SHORTS'].includes(t))   return 'bottom';
  if (['JACKET', 'COAT', 'BLAZER'].includes(t))                return 'outerwear';
  if (['SNEAKERS', 'LOAFERS', 'BOOTS', 'SHOES'].includes(t))   return 'footwear';
  return 'accessory';
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
