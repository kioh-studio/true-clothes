// Profile service — read/update `public.profiles`. RLS scopes every row to
// the authenticated user. The `on_auth_user_created` trigger ensures a row
// exists immediately after signup, so we always upsert/update, never insert.
//
// The app holds profile data in slightly different shapes than the DB
// (e.g. dob as "DD/MM/YYYY", location as "City, Country"). This service
// is the only place where that mapping happens — stores and screens pass
// app-shaped values; we translate at the boundary.
import * as FileSystem from 'expo-file-system/legacy';
import { sb } from './supabase';
import { AvatarUploadError, ProfileUpdateError } from '../types/profile';

// ── DB row shape (subset we touch) ───────────────────────────────────────────
export interface ProfileRow {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;            // enum: WOMAN | MAN | NON-BINARY | PREFER NOT TO SAY
  date_of_birth: string | null;     // ISO YYYY-MM-DD
  location_city: string | null;
  location_country: string | null;
  onboarding_complete: boolean;
  color_season: string | null;
  personal_palette: string[];
}

// ── App-shaped data (what stores/screens use) ────────────────────────────────
export interface ProfilePatch {
  email?: string;
  phone?: string;
  gender?: string;          // pass-through; caller should send the enum value
  dob?: string;             // "DD/MM/YYYY" (app format)
  location?: string;        // "City, Country" (combined)
  fullName?: string;
  displayName?: string;
  colorSeason?: string | null;
  personalPalette?: string[];
}

// ── DD/MM/YYYY ↔ YYYY-MM-DD ──────────────────────────────────────────────────
function dobAppToIso(dob: string | undefined): string | null | undefined {
  if (dob === undefined) return undefined;     // not touched
  if (!dob) return null;                       // explicit clear
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}
function dobIsoToApp(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

// ── "City, Country" ↔ {city, country} ────────────────────────────────────────
function splitLocation(loc: string | undefined): { city: string | null; country: string | null } | undefined {
  if (loc === undefined) return undefined;
  if (!loc.trim()) return { city: null, country: null };
  const parts = loc.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { city: null, country: null };
  if (parts.length === 1) return { city: parts[0], country: null };
  return { city: parts[0], country: parts.slice(1).join(', ') };
}
function joinLocation(city: string | null, country: string | null): string {
  if (city && country) return `${city}, ${country}`;
  return city || country || '';
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, display_name, avatar_url, avatar_path, email, phone, gender, date_of_birth, location_city, location_country, onboarding_complete, color_season, personal_palette')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[profileService] fetch failed:', error.message);
    return null;
  }
  return data as ProfileRow | null;
}

/** Patch one or more app-shaped fields onto `public.profiles`. */
export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<{ ok: boolean; message?: string }> {
  const row: Record<string, string | boolean | null> = {};

  if (patch.fullName     !== undefined) row.full_name    = patch.fullName || null;
  if (patch.displayName  !== undefined) row.display_name = patch.displayName || null;
  if (patch.email        !== undefined) row.email        = patch.email || null;
  if (patch.phone        !== undefined) row.phone        = patch.phone || null;
  if (patch.gender       !== undefined) row.gender       = patch.gender || null;
  if (patch.colorSeason  !== undefined) row.color_season = patch.colorSeason ?? null;
  if (patch.personalPalette !== undefined) (row as Record<string, unknown>).personal_palette = patch.personalPalette;

  const iso = dobAppToIso(patch.dob);
  if (iso !== undefined) row.date_of_birth = iso;

  const loc = splitLocation(patch.location);
  if (loc) {
    row.location_city    = loc.city;
    row.location_country = loc.country;
  }

  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await sb.from('profiles').update(row).eq('id', userId);
  if (error) {
    console.warn('[profileService] update failed:', error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

// ── Account type (profiles.account_type) ─────────────────────────────────────
export type AccountType = 'free' | 'premium' | 'demo' | 'admin';

/** Read the current user's stored account_type (DB source of truth). */
export async function fetchMyAccountType(): Promise<AccountType> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return 'free';
  const { data, error } = await sb
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return 'free';
  return ((data as { account_type: AccountType }).account_type) ?? 'free';
}

/** True when the stored account_type grants premium features (premium or admin). */
export async function hasPremiumAccountType(): Promise<boolean> {
  const t = await fetchMyAccountType();
  return t === 'premium' || t === 'admin';
}

export async function markOnboardingComplete(userId: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await sb
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Upload a local image URI as the user's avatar. Returns the public URL + storage path. */
export async function uploadAvatar(userId: string, localUri: string, currentAvatarPath: string | null): Promise<{ avatarUrl: string; avatarPath: string }> {
  // Delete previous avatar from storage first
  if (currentAvatarPath) {
    await sb.storage.from('avatars').remove([currentAvatarPath]).catch(() => {});
  }

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${userId}/${Date.now()}.${ext}`;

  // Read file as base64 and convert to ArrayBuffer
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const { error: uploadError } = await sb.storage.from('avatars').upload(path, binary, { contentType: mime, upsert: true });
  if (uploadError) throw new AvatarUploadError(uploadError.message);

  const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = urlData?.publicUrl ?? '';

  const { error: dbError } = await sb.from('profiles').update({ avatar_url: avatarUrl, avatar_path: path }).eq('id', userId);
  if (dbError) throw new ProfileUpdateError(dbError.message);

  return { avatarUrl, avatarPath: path };
}

/** Remove the user's avatar from storage and clear DB columns. */
export async function deleteAvatar(userId: string, avatarPath: string): Promise<void> {
  await sb.storage.from('avatars').remove([avatarPath]).catch(() => {});
  await sb.from('profiles').update({ avatar_url: null, avatar_path: null }).eq('id', userId);
}

// Re-export helpers for stores that need the same format mapping.
export { dobIsoToApp, joinLocation };
export { ProfileUpdateError, AvatarUploadError };
