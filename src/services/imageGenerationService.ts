import * as FileSystem from 'expo-file-system/legacy';
import { sb } from './supabase';
import { LogoSignal, MKey } from '../types/fitEngine';

// ─── Contract types (camelCase mirror of the generate-item-image output) ──────

export interface GarmentMetadata {
  type: string;                       // controlled (UPPERCASE) — engine reads this
  name: string;
  description: string;                // image-gen prompt only; not persisted
  color: string;                      // controlled (Title Case)
  material: string | null;            // controlled or null
  fit: string | null;                 // slim|regular|relaxed|wide|oversized or null
  pattern: string | null;             // controlled or null
  warmthSeason: string | null;        // one of 4 or null
  measurements: Partial<Record<MKey, number>>; // estimated cm
  brand: string | null;
  graphics: LogoSignal | null;        // captured, not scored (MVP)
  tags: string[];                     // UI/filter only
  confidence: number;
}

/** One extracted item: isolated product image (local file) + controlled-vocab metadata. */
export interface ExtractedItemWithImage {
  localImageUri: string | null;       // null when image generation failed → placeholder
  metadata: GarmentMetadata;
  usedFallback?: boolean;             // on-device item method: background couldn't be isolated cleanly
}

// ─── Internal: edge (snake_case) → domain (camelCase) ─────────────────────────

interface RawMetadata {
  type: string; name: string; description?: string; color: string;
  material: string | null; fit: string | null; pattern: string | null;
  warmth_season: string | null; measurements?: Partial<Record<MKey, number>>;
  brand: string | null; graphics: LogoSignal | null; tags?: string[]; confidence?: number;
}

function toDomain(m: RawMetadata): GarmentMetadata {
  return {
    type: m.type,
    name: m.name,
    description: m.description ?? '',
    color: m.color,
    material: m.material ?? null,
    fit: m.fit ?? null,
    pattern: m.pattern ?? null,
    warmthSeason: m.warmth_season ?? null,
    measurements: m.measurements ?? {},
    brand: m.brand ?? null,
    graphics: m.graphics ?? null,
    tags: Array.isArray(m.tags) ? m.tags : [],
    confidence: typeof m.confidence === 'number' ? m.confidence : 0.5,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Send ONE worn-outfit photo to the generate-item-image Edge Function.
 * Returns one entry per detected garment: an isolated product image saved to device
 * storage (or null on image failure) + controlled-vocab metadata. Order = pairing.
 *
 * @param photoUri  base64 data URI of the outfit photo
 * @param notes     optional untrusted enrichment context
 */
export async function extractItemsWithImages(
  photoUri: string,
  notes?: string,
): Promise<ExtractedItemWithImage[]> {
  const { data, error } = await sb.functions.invoke('generate-item-image', {
    body: { photo_uri: photoUri, notes: notes ?? '' },
  });
  if (error) throw error;

  const res = data as {
    items?: Array<{ image_data: string; mime_type: string; metadata: RawMetadata }>;
  };
  if (!Array.isArray(res?.items)) throw new Error('Unexpected response from generate-item-image');

  const dir = `${FileSystem.documentDirectory}wardrobe/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  return Promise.all(
    res.items.map(async (item) => {
      let localImageUri: string | null = null;
      if (item.image_data) {
        const ext = item.mime_type.includes('png') ? 'png' : 'jpg';
        const dest = `${dir}ai_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        try {
          await FileSystem.writeAsStringAsync(dest, item.image_data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          localImageUri = dest;
        } catch {
          // keep null — review shows a placeholder, item stays editable/saveable
        }
      }
      return { localImageUri, metadata: toDomain(item.metadata) };
    }),
  );
}
