import * as FileSystem from 'expo-file-system/legacy';
import { sb } from './supabase';
import { LogoSignal, MKey, PrintScale, Drape } from '../types/fitEngine';
import i18n from '../i18n';

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
  // Measured-hex color layer (2026-07-06) — deterministic pixel-derived
  // dominant colour(s) of the isolated item image. AI path: computed server-
  // side by generate-item-image; on-device extract-by-item path: computed by
  // colorClusterUri at ingest. Optional so older construction sites (try-on
  // scan, test fixtures) stay valid; absent/null → hex arrives later via the
  // backfill-item-metadata admin run.
  primaryHex?: string | null;
  secondaryHex?: string | null;
  // Distressed/worn-in finish (2026-08-11) — see types/fitEngine.ts
  // WardrobeItem.distressed for the exact definition. Optional so older
  // construction sites (try-on scan, test fixtures) stay valid; absent/null
  // → the column stays NULL and the backfill run fills it later.
  distressed?: boolean | null;
  // Dual-role layering (2026-07-03 schema) — the AI's own can-be-worn-open/
  // over estimate, server field `can_layer`. Previously extracted server-side
  // but never carried past this client boundary (2026-08-11 fix): every
  // caller either forced ExtractedItem.canLayer to null or omitted it from
  // the insert entirely, so a fresh item always started at AUTO even when the
  // model had an opinion. Optional for the same construction-site reasons as
  // distressed above; on-device extract-by-item has no source → stays null.
  canLayer?: boolean | null;
  // Visual enrichment đợt 2 (2026-07-03 schema, 2026-08-11 client threading) —
  // print/graphic scale as worn, fabric drape, and how visually striking the
  // piece reads. The server extraction schema (generate-item-image/prompt.ts)
  // already returns these; this client mirror + toDomain below is what was
  // missing — without it useAddWizard/AddItemInput had nothing to read, so a
  // fresh insert left the columns NULL until backfill-item-metadata re-derived
  // them (a second paid Gemini pass for data already extracted). Optional:
  // on-device extract-by-item has no visual-judgment source → stays null.
  printScale?: PrintScale | null;
  drape?: Drape | null;
  visualInterest?: number | null;
}

/** One extracted item: isolated product image (local file) + controlled-vocab metadata. */
export interface ExtractedItemWithImage {
  localImageUri: string | null;       // null when image generation failed → placeholder
  metadata: GarmentMetadata;
  usedFallback?: boolean;             // on-device item method: background couldn't be isolated cleanly
  keyed?: boolean;                    // AI path: background already removed server-side (transparent PNG)
}

// ─── Internal: edge (snake_case) → domain (camelCase) ─────────────────────────

interface RawMetadata {
  type: string; name: string; description?: string; color: string;
  material: string | null; fit: string | null; pattern: string | null;
  warmth_season: string | null; measurements?: Partial<Record<MKey, number>>;
  brand: string | null; graphics: LogoSignal | null; tags?: string[]; confidence?: number;
  primary_hex?: string | null; secondary_hex?: string | null;
  distressed?: boolean | null;
  can_layer?: boolean | null;
  print_scale?: PrintScale | null;
  drape?: Drape | null;
  visual_interest?: number | null;
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
    primaryHex: m.primary_hex ?? null,
    secondaryHex: m.secondary_hex ?? null,
    distressed: m.distressed ?? null,
    canLayer: m.can_layer ?? null,
    printScale: m.print_scale ?? null,
    drape: m.drape ?? null,
    visualInterest: typeof m.visual_interest === 'number' ? m.visual_interest : null,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Send ONE worn-outfit photo to the generate-item-image Edge Function.
 * Returns one entry per detected garment: an isolated product image saved to device
 * storage (or null on image failure) + controlled-vocab metadata. Order = pairing.
 *
 * CONVENTION — background removal. The edge function generates each item on a
 * uniform chroma background and keys it out SERVER-SIDE into a transparent PNG;
 * such items come back with `keyed: true` and need no further processing. When
 * keying could not be done reliably (`keyed: false`, e.g. a non-uniform AI bg),
 * the image still carries its background, so callers SHOULD fall back to the
 * on-device ML segmenter `cutoutOnDevice` (from `extractByItemService`) — a safe
 * no-op when the native module is absent. Current callers: `tryOnStore.scan()`
 * and `useAddWizard.analyse()` (via `refineAiCutout`), both gated on `!keyed`.
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
    items?: Array<{ image_data: string; mime_type: string; metadata: RawMetadata; keyed?: boolean }>;
  };
  if (!Array.isArray(res?.items)) throw new Error(i18n.t('extraction_extractionFailed'));

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
      return { localImageUri, metadata: toDomain(item.metadata), keyed: item.keyed ?? false };
    }),
  );
}
