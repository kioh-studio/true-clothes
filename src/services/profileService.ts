// Profile service — read/update `public.profiles`. RLS scopes every row to
// the authenticated user. The `on_auth_user_created` trigger ensures a row
// exists immediately after signup, so we always upsert/update, never insert.
//
// The app holds profile data in slightly different shapes than the DB
// (e.g. dob as "DD/MM/YYYY", location as "City, Country"). This service
// is the only place where that mapping happens — stores and screens pass
// app-shaped values; we translate at the boundary.
import { sb } from './supabase';

// ── DB row shape (subset we touch) ───────────────────────────────────────────
export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;            // enum: WOMAN | MAN | NON-BINARY | PREFER NOT TO SAY
  date_of_birth: string | null;     // ISO YYYY-MM-DD
  location_city: string | null;
  location_country: string | null;
  onboarding_complete: boolean;
}

// ── App-shaped data (what stores/screens use) ────────────────────────────────
export interface ProfilePatch {
  email?: string;
  phone?: string;
  gender?: string;          // pass-through; caller should send the enum value
  dob?: string;             // "DD/MM/YYYY" (app format)
  location?: string;        // "City, Country" (combined)
  fullName?: string;
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
    .select('id, full_name, email, phone, gender, date_of_birth, location_city, location_country, onboarding_complete')
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

  if (patch.fullName !== undefined) row.full_name = patch.fullName || null;
  if (patch.email    !== undefined) row.email     = patch.email || null;
  if (patch.phone    !== undefined) row.phone     = patch.phone || null;
  if (patch.gender   !== undefined) row.gender    = patch.gender || null;

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

export async function markOnboardingComplete(userId: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await sb
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Re-export helpers for stores that need the same format mapping.
export { dobIsoToApp, joinLocation };
