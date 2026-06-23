// wardrobeService — sole point of contact with clothing_items table and
// wardrobe-photos storage bucket. Screens and stores MUST NOT import `sb` directly.

import { sb } from './supabase';
import { WardrobeItem, PhotoStorageKind, MKey, LogoSignal } from '../types/fitEngine';
import { genId } from '../utils/genId';

// Garment measurement columns the engine reads (cm). Kept in one place so the
// add/read paths stay in sync with the DB m_* columns.
const M_KEYS: MKey[] = [
  'm_chest', 'm_shoulder_width', 'm_sleeves', 'm_body_length',
  'm_waist', 'm_hip', 'm_inseam', 'm_thigh', 'm_rise', 'm_skirt_length', 'm_shoe_size',
];
import {
  optimizeImage, writeDeviceCopy, uploadCloudCopy, removePhoto, relativePathFor, resolveDeviceUri,
} from './itemPhotoService';

export type StorageTier = 'free' | 'premium';

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
  name?: string;
  type?: string;              // real controlled garment type (TEE/JACKET…) — wins over category mapping
  primaryColor?: string;
  material?: string;
  fit?: string;               // controlled fit — engine reads this (feature 006)
  pattern?: string;
  warmthSeason?: string[];
  measurements?: Partial<Record<MKey, number>>;  // garment measurements in cm
  link?: string;              // product URL → source_url
  graphics?: LogoSignal | null;  // logo signals (feature 006)
  source?: string;            // provenance: 'ai' | 'item' | 'personal' (defaults to DB default)
}

export interface UpdateItemInput {
  colors?: string[];
  sizeLabel?: string;
  brand?: string;
  notes?: string;
  name?: string;
  type?: string;
  primaryColor?: string;
  material?: string;
  fit?: string;
  pattern?: string;
  warmthSeason?: string[];
  measurements?: Partial<Record<MKey, number>>;
  link?: string;
  graphics?: LogoSignal | null;
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
  primary_color: string | null;
  material: string | null;
  fit: string | null;
  fit_note: string | null;
  pattern: string | null;
  warmth_season: string[] | null;
  brand: string | null;
  size: string | null;
  source: string | null;
  source_url: string | null;
  graphics: LogoSignal | null;
  photo_url: string | null;
  photo_storage: PhotoStorageKind | null;
  times_worn: number;
  added_at: string;
  updated_at: string;
  // m_* measurement columns (cm) — engine reads these
  m_chest: number | null;
  m_shoulder_width: number | null;
  m_sleeves: number | null;
  m_body_length: number | null;
  m_waist: number | null;
  m_hip: number | null;
  m_inseam: number | null;
  m_thigh: number | null;
  m_rise: number | null;
  m_skirt_length: number | null;
  m_shoe_size: number | null;
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
  dress:     'DRESS',
  headwear:  'HAT',
};

function rowToItem(row: ClothingItemRow, userId: string): WardrobeItem {
  // Photo resolution (signed URL / local file) is lazy — done by useItemPhoto.
  // Here we only carry the discriminator and the persisted reference.
  return {
    id: row.id,
    userId,
    photoStorage: row.photo_storage ?? (row.photo_url ? 'cloud' : 'none'),
    photoUrl: null,
    photoLocalUri: null,
    photoPath: row.photo_url,
    category: inferCategory(row.type),
    type: row.type,
    colors: row.color ? [row.color] : [],
    sizeLabel: row.size,
    brand: row.brand,
    notes: null,
    createdAt: row.added_at ?? new Date().toISOString(),
    name: row.name,
    primaryColor: row.primary_color,
    material: row.material,
    fit: row.fit,
    pattern: row.pattern,
    // warmth_season is a text column — stored as a comma-joined list
    warmthSeason: row.warmth_season
      ? String(row.warmth_season).split(',').map(s => s.trim()).filter(Boolean)
      : [],
    measurements: collectMeasurements(row),
    graphics: row.graphics ?? null,
  };
}

// Gather the non-null m_* columns into a measurements object.
function collectMeasurements(row: ClothingItemRow): Partial<Record<MKey, number>> | null {
  const out: Partial<Record<MKey, number>> = {};
  for (const k of M_KEYS) {
    const v = row[k];
    if (typeof v === 'number' && !Number.isNaN(v)) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Spread a measurements object into individual m_* DB columns (cm).
function measurementColumns(
  m: Partial<Record<MKey, number>> | undefined,
): Record<string, number> {
  const cols: Record<string, number> = {};
  if (!m) return cols;
  for (const k of M_KEYS) {
    const v = m[k];
    if (typeof v === 'number' && !Number.isNaN(v) && v > 0) cols[k] = v;
  }
  return cols;
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

/** Fetch a single row (with photo fields) for cleanup/promotion flows. */
async function fetchRow(id: string): Promise<ClothingItemRow | null> {
  const { data, error } = await sb.from('clothing_items').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as ClothingItemRow;
}

// Build the persisted photo reference + discriminator for a picked image.
// Always writes a device copy (free: authoritative; premium: pending upload +
// offline cache). Premium additionally attempts an immediate cloud upload;
// on failure the item stays 'local' and is retried later (research D8).
async function storePhoto(
  userId: string, itemId: string, localPhotoUri: string, tier: StorageTier,
): Promise<{ photoStorage: PhotoStorageKind; photoPath: string; ext: 'jpg' | 'png' }> {
  // Preserve transparency for cut-out PNGs (Try On / AI / on-device extract);
  // raw photos stay JPEG. JPEG would flatten a transparent cut-out's background.
  const isPng = localPhotoUri.toLowerCase().split('?')[0].endsWith('.png');
  const format: 'jpg' | 'png' = isPng ? 'png' : 'jpg';

  const optimized = await optimizeImage(localPhotoUri, format);
  const relativePath = await writeDeviceCopy(itemId, optimized.uri, optimized.ext);
  if (tier === 'premium') {
    try {
      const storagePath = await uploadCloudCopy(userId, itemId, optimized.uri, optimized.ext);
      return { photoStorage: 'cloud', photoPath: storagePath, ext: optimized.ext };
    } catch (err) {
      console.warn('[wardrobeService] cloud upload deferred (kept local):', err);
    }
  }
  return { photoStorage: 'local', photoPath: relativePath, ext: optimized.ext };
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
export async function addItem(input: AddItemInput, tier: StorageTier = 'free'): Promise<WardrobeItem> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new WardrobeDbError('Not authenticated');

  const wardrobeId = await getWardrobeId(user.id);
  if (!wardrobeId) throw new WardrobeDbError('Wardrobe not found');

  // Generate the id up front so device path / storage path / row id all align.
  const itemId = genId();
  let photoStorage: PhotoStorageKind = 'none';
  let photoPath: string | null = null;
  let photoExt: 'jpg' | 'png' = 'jpg';

  if (input.localPhotoUri) {
    try {
      const stored = await storePhoto(user.id, itemId, input.localPhotoUri, tier);
      photoStorage = stored.photoStorage;
      photoPath = stored.photoPath;
      photoExt = stored.ext;
    } catch (err) {
      throw new WardrobeStorageError('Could not store photo', err);
    }
  }

  const color = input.colors[0] ?? null;
  const { data, error: dbError } = await sb
    .from('clothing_items')
    .insert({
      id:           itemId,
      wardrobe_id:  wardrobeId,
      // Real controlled type wins; fall back to category mapping for manual adds.
      type:         input.type ?? CATEGORY_TO_TYPE[input.category],
      name:         input.name ?? null,
      color,
      primary_color: input.primaryColor ?? color,
      // fabric_types.name is lowercase (FK); the AI emits Title Case → normalise.
      material:     input.material ? input.material.toLowerCase() : null,
      fit:          input.fit ?? null,
      pattern:      input.pattern ?? null,
      // text column — serialize as comma-joined list
      warmth_season: input.warmthSeason?.length ? input.warmthSeason.join(',') : null,
      size:         input.sizeLabel ?? null,
      brand:        input.brand ?? null,
      source_url:   input.link ?? null,
      graphics:     input.graphics ?? null,
      ...(input.source ? { source: input.source } : {}),
      ...measurementColumns(input.measurements),
      photo_url:    photoPath,
      photo_storage: photoStorage,
    })
    .select()
    .single();

  if (dbError) {
    // Roll back stored photo (device + cloud) so a failed insert leaves no orphan.
    removePhoto({
      relativePath: photoStorage === 'local' ? photoPath : relativePathFor(itemId, photoExt),
      storagePath:  photoStorage === 'cloud' ? photoPath : null,
    }).catch(() => {});
    throw new WardrobeDbError('Failed to save clothing item', dbError);
  }

  return rowToItem(data as ClothingItemRow, user.id);
}

/** Replace an item's photo: clean up the prior copy, store the new one per tier. */
export async function replaceItemPhoto(id: string, localPhotoUri: string, tier: StorageTier): Promise<WardrobeItem> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new WardrobeDbError('Not authenticated');

  const row = await fetchRow(id);
  if (!row) throw new WardrobeDbError('Item not found');

  // Remove the previous photo (device or cloud) before writing the new one.
  await removePhoto({
    relativePath: row.photo_storage === 'local' ? row.photo_url : null,
    storagePath:  row.photo_storage === 'cloud' ? row.photo_url : null,
  });

  const stored = await storePhoto(user.id, id, localPhotoUri, tier);
  const { data, error } = await sb
    .from('clothing_items')
    .update({ photo_url: stored.photoPath, photo_storage: stored.photoStorage })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new WardrobeDbError('Failed to update photo', error);
  return rowToItem(data as ClothingItemRow, user.id);
}

/** Items whose photo is still local — pending cloud upload / migration candidates (premium). */
export async function listPendingCloudUploads(): Promise<WardrobeItem[]> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const wardrobeId = await getWardrobeId(user.id);
  if (!wardrobeId) return [];

  const { data, error } = await sb
    .from('clothing_items')
    .select('*')
    .eq('wardrobe_id', wardrobeId)
    .eq('photo_storage', 'local');
  if (error || !data) return [];
  return (data as ClothingItemRow[]).map(row => rowToItem(row, user.id));
}

/** Upload a local item's device copy to the cloud and flip photo_storage→'cloud'. Idempotent. */
export async function promoteToCloud(id: string): Promise<WardrobeItem | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const row = await fetchRow(id);
  if (!row) return null;
  // Not a real on-device file (already cloud, no photo, a bundled asset ref, or a
  // direct remote URL) → nothing to upload.
  if (row.photo_storage !== 'local' || !row.photo_url
      || row.photo_url.startsWith('asset:') || /^https?:\/\//.test(row.photo_url)) {
    return rowToItem(row, user.id);
  }

  const deviceUri = await resolveDeviceUri(row.photo_url);
  if (!deviceUri) {
    // Local file is gone (e.g. reclaimed) — cannot promote; leave as-is.
    return rowToItem(row, user.id);
  }
  let storagePath: string;
  try {
    const ext: 'jpg' | 'png' = row.photo_url.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    storagePath = await uploadCloudCopy(user.id, id, deviceUri, ext);
  } catch (err) {
    console.warn('[wardrobeService] promoteToCloud upload failed (will retry):', err);
    return rowToItem(row, user.id);
  }

  const { data, error } = await sb
    .from('clothing_items')
    .update({ photo_url: storagePath, photo_storage: 'cloud' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    // DB flip failed — remove the just-uploaded object to avoid an orphan.
    removePhoto({ storagePath }).catch(() => {});
    return rowToItem(row, user.id);
  }
  // Device copy is retained as the premium cache (FR-008a).
  return rowToItem(data as ClothingItemRow, user.id);
}

/**
 * Update metadata for an existing item.
 */
export async function updateItem(id: string, patch: UpdateItemInput): Promise<WardrobeItem> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new WardrobeDbError('Not authenticated');

  const dbPatch: Record<string, unknown> = {};
  if (patch.colors !== undefined)      dbPatch.color         = patch.colors[0] ?? null;
  if (patch.sizeLabel !== undefined)   dbPatch.size          = patch.sizeLabel;
  if (patch.brand !== undefined)       dbPatch.brand         = patch.brand;
  if (patch.name !== undefined)        dbPatch.name          = patch.name;
  if (patch.type !== undefined)        dbPatch.type          = patch.type;
  if (patch.primaryColor !== undefined) dbPatch.primary_color = patch.primaryColor;
  if (patch.material !== undefined)    dbPatch.material      = patch.material ? patch.material.toLowerCase() : null;
  if (patch.fit !== undefined)         dbPatch.fit           = patch.fit;
  if (patch.pattern !== undefined)     dbPatch.pattern       = patch.pattern;
  if (patch.link !== undefined)        dbPatch.source_url    = patch.link;
  if (patch.graphics !== undefined)    dbPatch.graphics      = patch.graphics;
  if (patch.measurements !== undefined) Object.assign(dbPatch, measurementColumns(patch.measurements));
  if (patch.warmthSeason !== undefined) {
    dbPatch.warmth_season = patch.warmthSeason?.length ? patch.warmthSeason.join(',') : null;
  }

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
  // Clean up the item's photo (device + cloud) so no orphan storage remains (FR-014).
  const row = await fetchRow(id);
  if (row?.photo_url) {
    await removePhoto({
      relativePath: row.photo_storage === 'local' ? row.photo_url : null,
      storagePath:  row.photo_storage === 'cloud' ? row.photo_url : null,
    });
  }

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
  tier: StorageTier = 'free',
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
      }, tier);
      migrated.push(item);
    } catch (err) {
      console.warn(`[wardrobeService] Migration failed for item ${legacy.id}:`, err);
    }
    onProgress?.(i + 1, total);
  }

  return migrated;
}
