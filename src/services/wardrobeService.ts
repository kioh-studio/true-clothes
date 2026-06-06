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

// ─── Internal DB row type (matches actual schema) ────────────────────────────

interface ClothingItemRow {
  id: string;
  wardrobe_id: string;
  type: string | null;
  name: string | null;
  color: string | null;
  material: string | null;
  brand: string | null;
  size: string | null;
  photo_url: string | null;
  times_worn: number;
  added_at: string;
  updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferCategory(type: string | null): WardrobeItem['category'] {
  const t = (type ?? '').toUpperCase();
  if (['TEE', 'POLO', 'SHIRT', 'KNIT', 'SWEATER', 'HENLEY'].includes(t)) return 'top';
  if (['JEANS', 'CHINOS', 'TROUSERS', 'SHORTS'].includes(t))             return 'bottom';
  if (['JACKET', 'COAT', 'BLAZER'].includes(t))                          return 'outerwear';
  if (['SNEAKERS', 'LOAFERS', 'BOOTS', 'SHOES', 'MULES'].includes(t))   return 'footwear';
  return 'accessory';
}

// Map WardrobeItem category back to a generic type string for DB inserts
const CATEGORY_TO_TYPE: Record<WardrobeItem['category'], string> = {
  top:       'TEE',
  bottom:    'JEANS',
  outerwear: 'JACKET',
  footwear:  'SNEAKERS',
  accessory: 'BAG',
};

function rowToItem(row: ClothingItemRow, userId: string): WardrobeItem {
  return {
    id: row.id,
    userId,
    photoUrl: row.photo_url,
    photoPath: null,
    category: inferCategory(row.type),
    colors: row.color ? [row.color] : [],
    sizeLabel: row.size,
    brand: row.brand,
    notes: null,
    createdAt: row.added_at ?? new Date().toISOString(),
  };
}

async function getWardrobeId(userId: string): Promise<string | null> {
  const { data, error } = await sb
    .from('wardrobes')
    .select('id')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all clothing items for the authenticated user, ordered by added_at DESC.
 * Returns empty array if not authenticated or no items.
 */
export async function fetchMyItems(): Promise<WardrobeItem[]> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const wardrobeId = await getWardrobeId(user.id);
  if (!wardrobeId) return [];

  const { data, error } = await sb
    .from('clothing_items')
    .select('*')
    .eq('wardrobe_id', wardrobeId)
    .order('added_at', { ascending: false });

  if (error) throw new WardrobeDbError('Failed to fetch wardrobe items', error);
  if (!data || data.length === 0) return [];

  return (data as ClothingItemRow[]).map(row => rowToItem(row, user.id));
}

/**
 * Add a new clothing item.
 * 1. Uploads photo to Storage (if localPhotoUri provided).
 * 2. Inserts row to clothing_items.
 * 3. Returns the created WardrobeItem.
 *
 * Throws WardrobeStorageError if upload fails.
 * Throws WardrobeDbError if insert fails.
 */
export async function addItem(input: AddItemInput): Promise<WardrobeItem> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new WardrobeDbError('Not authenticated');

  const wardrobeId = await getWardrobeId(user.id);
  if (!wardrobeId) throw new WardrobeDbError('Wardrobe not found');

  let photoUrl: string | null = null;
  let storagePath: string | null = null;

  if (input.localPhotoUri) {
    const itemId = crypto.randomUUID();
    storagePath = `${user.id}/${itemId}.jpg`;

    const fileInfo = await FileSystem.getInfoAsync(input.localPhotoUri);
    if (!fileInfo.exists) throw new WardrobeStorageError('Photo file not found');

    const base64 = await FileSystem.readAsStringAsync(input.localPhotoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const blob = base64ToBlob(base64, 'image/jpeg');

    const { error: uploadError } = await sb.storage
      .from('wardrobe-photos')
      .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw new WardrobeStorageError('Photo upload failed', uploadError);

    const { data: urlData } = sb.storage
      .from('wardrobe-photos')
      .getPublicUrl(storagePath);
    photoUrl = urlData?.publicUrl ?? null;
  }

  const { data, error: dbError } = await sb
    .from('clothing_items')
    .insert({
      wardrobe_id: wardrobeId,
      type: CATEGORY_TO_TYPE[input.category],
      color: input.colors[0] ?? null,
      size: input.sizeLabel ?? null,
      brand: input.brand ?? null,
      photo_url: photoUrl,
    })
    .select()
    .single();

  if (dbError) {
    if (storagePath) {
      sb.storage.from('wardrobe-photos').remove([storagePath]).catch(err =>
        console.warn('[wardrobeService] Storage cleanup failed after DB error:', err)
      );
    }
    throw new WardrobeDbError('Failed to save clothing item', dbError);
  }

  return rowToItem(data as ClothingItemRow, user.id);
}

/**
 * Update metadata for an existing item.
 */
export async function updateItem(id: string, patch: UpdateItemInput): Promise<WardrobeItem> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new WardrobeDbError('Not authenticated');

  const dbPatch: Record<string, unknown> = {};
  if (patch.colors !== undefined)    dbPatch.color = patch.colors[0] ?? null;
  if (patch.sizeLabel !== undefined) dbPatch.size  = patch.sizeLabel;
  if (patch.brand !== undefined)     dbPatch.brand = patch.brand;

  const { data, error } = await sb
    .from('clothing_items')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new WardrobeDbError('Failed to update clothing item', error);
  return rowToItem(data as ClothingItemRow, user.id);
}

/**
 * Delete a clothing item by ID.
 */
export async function deleteItem(id: string): Promise<void> {
  const { error } = await sb
    .from('clothing_items')
    .delete()
    .eq('id', id);

  if (error) throw new WardrobeDbError('Failed to delete clothing item', error);
}

/**
 * Migrate legacy AsyncStorage items to Supabase.
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
