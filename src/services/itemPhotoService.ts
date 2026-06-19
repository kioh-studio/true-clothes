// itemPhotoService — device + cloud mechanics for wardrobe item photos
// (feature 003-upload-image). Lower-level than wardrobeService, which composes
// these calls. Screens/stores MUST NOT import this directly — go through
// wardrobeService / useItemPhoto.
//
// SDK 19 note (research D10): the classic file API (documentDirectory,
// readAsStringAsync, downloadAsync, copyAsync, …) moved to the `/legacy`
// entry point; importing it there is what keeps `tsc` clean.

import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';
import { sb } from './supabase';

export type PhotoStorageKind = 'none' | 'local' | 'cloud';

const BUCKET = 'wardrobe-photos';
const SUBDIR = 'wardrobe-photos/';               // under documentDirectory
const MAX_LONG_EDGE = 1600;                       // px (FR-006 / SC-009)
const JPEG_QUALITY = 0.7;
const SIGNED_URL_TTL = 3600;                      // seconds (FR-016: expiring)

export class PhotoStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PhotoStorageError';
  }
}

// ─── Paths ───────────────────────────────────────────────────────────────────

/** Relative reference persisted to the DB for both local files and cloud caches. */
export function relativePathFor(itemId: string): string {
  return `${SUBDIR}${itemId}.jpg`;
}

function absoluteFor(relativePath: string): string {
  return `${FileSystem.documentDirectory}${relativePath}`;
}

async function ensureDir(): Promise<void> {
  const dir = `${FileSystem.documentDirectory}${SUBDIR}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// ─── Optimization ──────────────────────────────────────────────────────────

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/** Resize so the long edge ≤ MAX_LONG_EDGE and compress to JPEG (FR-006/SC-009). */
export async function optimizeImage(localUri: string): Promise<{ uri: string; width: number; height: number }> {
  let actions: { resize: { width: number; height: number } }[] = [];
  try {
    const { width, height } = await imageSize(localUri);
    const longEdge = Math.max(width, height);
    if (longEdge > MAX_LONG_EDGE) {
      const scale = MAX_LONG_EDGE / longEdge;
      actions = [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }];
    }
  } catch {
    // Size probe failed (unusual) — fall back to a width cap.
    actions = [{ resize: { width: MAX_LONG_EDGE, height: MAX_LONG_EDGE } }];
  }
  const result = await manipulateAsync(localUri, actions, { compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: result.uri, width: result.width, height: result.height };
}

// ─── Device storage ──────────────────────────────────────────────────────────

/** Copy an optimized file into the stable device dir. Returns the RELATIVE path. */
export async function writeDeviceCopy(itemId: string, optimizedUri: string): Promise<string> {
  await ensureDir();
  const relativePath = relativePathFor(itemId);
  const dest = absoluteFor(relativePath);
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.copyAsync({ from: optimizedUri, to: dest });
  return relativePath;
}

/** Absolute device uri for a relative path, or null if the file is absent. */
export async function resolveDeviceUri(relativePath: string): Promise<string | null> {
  const abs = absoluteFor(relativePath);
  const info = await FileSystem.getInfoAsync(abs);
  return info.exists ? abs : null;
}

// ─── Cloud storage (private bucket, signed URLs) ──────────────────────────────

/** Upload an optimized file to the private bucket. Returns storage path {userId}/{itemId}.jpg. */
export async function uploadCloudCopy(userId: string, itemId: string, optimizedUri: string): Promise<string> {
  const storagePath = `${userId}/${itemId}.jpg`;
  const base64 = await FileSystem.readAsStringAsync(optimizedUri, { encoding: 'base64' });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new PhotoStorageError('Cloud upload failed', error);
  return storagePath;
}

/** Short-lived signed URL for a private object (FR-016: never public, always expiring). */
export async function signedUrl(storagePath: string, expiresInSec: number = SIGNED_URL_TTL): Promise<string> {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) throw new PhotoStorageError('Could not sign photo URL', error);
  return data.signedUrl;
}

/** Ensure a cloud object is cached on-device (premium offline + instant repeat, FR-008a). */
export async function ensureCloudCached(itemId: string, storagePath: string): Promise<string> {
  await ensureDir();
  const dest = absoluteFor(relativePathFor(itemId));
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;
  const url = await signedUrl(storagePath);
  const { uri } = await FileSystem.downloadAsync(url, dest);
  return uri;
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

/** Remove device copy and/or cloud object. Best-effort; never throws on missing (D9). */
export async function removePhoto(args: { relativePath?: string | null; storagePath?: string | null }): Promise<void> {
  if (args.relativePath) {
    await FileSystem.deleteAsync(absoluteFor(args.relativePath), { idempotent: true }).catch(() => {});
  }
  if (args.storagePath) {
    await sb.storage.from(BUCKET).remove([args.storagePath]).catch(() => {});
  }
}
