// tryOnWearService — client side of the AI "wear on you" try-on (feature 009).
//
// Two edge calls:
//   validatePersonPhoto → tryon-validate  (cheap gate: is there a clear person?)
//   generateWearOn      → tryon-generate  (renders the user wearing the outfit)
//
// The user's photo is downscaled on-device, sent as a transient base64 data URI,
// and never uploaded to storage. The generated result is written to a local
// file (documentDirectory) so it persists for the session and can be re-shown.

import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { sb } from './supabase';
import { signedUrl } from './itemPhotoService';
import type {
  PhotoValidation, WearGarment, WearProfile, WearOnResult,
} from '../types/tryOn';

/** Minimal shape needed to turn a wardrobe item into a try-on garment. */
export interface GarmentSource {
  type: string | null;
  category?: string;
  name?: string | null;
  primaryColor?: string | null;
  colors?: string[];
  material?: string | null;
  fit?: string | null;
  photoStorage?: 'none' | 'local' | 'cloud';
  photoPath?: string | null;
}

// Resolve a remote image URL the edge function can fetch. Only cloud-stored items
// (private bucket) and already-remote URLs are fetchable; local/asset/none items
// fall back to a text-only descriptor (the model still renders from the name +
// colour + fit). Best-effort — signing failure just drops the image.
async function resolveGarmentUrl(item: GarmentSource): Promise<string | undefined> {
  const path = item.photoPath;
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('asset:')) return undefined;
  if (item.photoStorage !== 'cloud') return undefined;
  try {
    return await signedUrl(path);
  } catch {
    return undefined;
  }
}

/** Build the garment payload (with signed image URLs where available) for an outfit. */
export async function buildWearGarments(items: GarmentSource[]): Promise<WearGarment[]> {
  return Promise.all(items.map(async (it) => ({
    type: (it.type || it.category || 'item').toUpperCase(),
    name: it.name ?? undefined,
    color: it.primaryColor ?? it.colors?.[0] ?? undefined,
    material: it.material ?? null,
    fit: it.fit ?? null,
    imageUrl: await resolveGarmentUrl(it),
  })));
}

const MAX_EDGE = 1280;        // downscale the user photo before upload
const JPEG_QUALITY = 0.8;

/** Downscale a local image and return a base64 JPEG data URI. */
async function toScaledDataUri(localUri: string): Promise<string> {
  // ALWAYS run through the manipulator: besides resizing, it normalises the
  // platform picker URIs (Android `content://`, iOS `ph://`) into a readable
  // `file://` JPEG. The old code caught a manipulator failure and then tried to
  // read the ORIGINAL uri directly — but `readAsStringAsync` cannot read a raw
  // `content://` on Android, so the whole try-on threw before it ever reached
  // the edge function. Letting a genuine manipulator error propagate gives the
  // caller a clear failure to surface instead of a misleading read error.
  const out = await manipulateAsync(
    localUri,
    [{ resize: { width: MAX_EDGE } }],
    { compress: JPEG_QUALITY, format: SaveFormat.JPEG },
  );
  const b64 = await FileSystem.readAsStringAsync(out.uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:image/jpeg;base64,${b64}`;
}

/**
 * Gate an uploaded photo before the expensive generation: confirms a single
 * clear human subject. Returns { valid, reason } — reason is user-facing copy
 * (Vietnamese) explaining why to pick another photo when invalid.
 */
export async function validatePersonPhoto(localUri: string): Promise<PhotoValidation> {
  const dataUri = await toScaledDataUri(localUri);
  const { data, error } = await sb.functions.invoke('tryon-validate', {
    body: { photo_uri: dataUri },
  });
  if (error) throw error;
  const res = data as Partial<PhotoValidation>;
  return {
    valid: res?.valid === true,
    reason: typeof res?.reason === 'string' ? res.reason : '',
  };
}

/** Map a WearProfile (camelCase) → the edge function's snake_case payload. */
function profilePayload(p?: WearProfile) {
  if (!p) return undefined;
  return {
    gender: p.gender,
    age: p.age,
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    body_shape: p.bodyShape,
    preferred_fit: p.preferredFit,
    measurements_cm: p.measurementsCm,
  };
}

export interface GenerateWearOnArgs {
  /** Local file uri of the (already validated) user photo. */
  personUri: string;
  garments: WearGarment[];
  profile?: WearProfile;
  context?: { title?: string; style?: string; occasion?: string };
}

/**
 * Render the user wearing the outfit. Writes the returned image to a local file
 * and returns its uri. Throws on failure (the caller shows an error + retry);
 * no credit is consumed here (the hook gates that).
 */
export async function generateWearOn(args: GenerateWearOnArgs): Promise<WearOnResult> {
  const personDataUri = await toScaledDataUri(args.personUri);

  const { data, error } = await sb.functions.invoke('tryon-generate', {
    body: {
      person_uri: personDataUri,
      garments: args.garments.map((g) => ({
        type: g.type, name: g.name, color: g.color,
        material: g.material ?? undefined, fit: g.fit ?? undefined,
        image_url: g.imageUrl,
      })),
      profile: profilePayload(args.profile),
      context: args.context ?? {},
    },
  });
  if (error) throw error;

  const res = data as { image_data?: string; mime_type?: string; quality_warning?: boolean };
  if (!res?.image_data) throw new Error('No image returned from try-on generation');

  const dir = `${FileSystem.documentDirectory}try-on/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const ext = res.mime_type?.includes('png') ? 'png' : 'jpg';
  const dest = `${dir}wear_${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(dest, res.image_data, { encoding: FileSystem.EncodingType.Base64 });

  return { localImageUri: dest, qualityWarning: res.quality_warning === true };
}
