// Auth store — Supabase-backed.
//
// Two-step OTP (phone OR email — user only needs one):
//   1. sendOtp(phone, email)  → phone takes precedence; falls back to email OTP
//   2. verifyOtp(code)        → routes to sms or email verify based on pendingAuthMethod
//
// Profile data (gender / dob / location / email) is persisted to
// `public.profiles` via profileService; we keep a hydrated copy in state for
// fast UI. Supabase persists the session to AsyncStorage on its own.
//
// Per CLAUDE.md: screens are thin, no business logic; the store mediates
// services. We never call the Supabase client directly from here either —
// always via the service modules.
import { create } from 'zustand';
import {
  sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, verifyEmailOtp,
  toE164, getCurrentUserId, signOut, signInWithPassword,
  type AuthResult,
} from '../services/authService';
import {
  fetchMyMeasurements, upsertMyMeasurements,
} from '../services/measurementService';
import type { BodyMeasurements } from '../types/measurements';
import {
  updateMyProfile, markOnboardingComplete,
  uploadAvatar as svcUploadAvatar,
  dobIsoToApp, joinLocation,
  type ProfilePatch,
  type ProfileRow,
} from '../services/profileService';
import type { ColorSeason } from '../types/profile';
import type { ColorTone12 } from '../features/personal-color/tone12';
import { sb } from '../services/supabase';
import { DEMO_PHONE, DEMO_EMAIL, DEMO_OTP, DEMO_PASSWORD, DEMO_PROFILE } from '../config/demo';
import { useFitEngineStore } from './fitEngineStore';
import { useAppStore } from './appStore';
import { withTimeout, HYDRATE_TIMEOUT_MS } from '../utils/withTimeout';
import i18n from '../i18n';

// ─── Module-level listener guard (Bug 1) ─────────────────────────────────────
// authStore.hydrate() can be invoked more than once (Fast Refresh, remount).
// Without this guard each call registers another onAuthStateChange listener,
// stacking duplicate hydrateProfile calls per auth event.
let _authListenerRegistered = false;

// ─── In-flight hydrate guard ──────────────────────────────────────────────────
// hydrate() can be invoked twice nearly simultaneously (e.g. INITIAL_SESSION
// listener setup racing a direct hydrate() call from app boot). Without this,
// two overlapping runs fetch/reconcile profile state independently, last-write
// wins. A second call while one is in flight reuses the same promise instead.
let _hydrateInFlight: Promise<void> | null = null;

interface AuthState {
  isLoggedIn: boolean;
  onboardingComplete: boolean;
  // Profile fields (app-shape)
  phone: string;
  email: string;
  gender: string;
  dob: string;       // "DD/MM/YYYY"
  location: string;  // "City, Country"
  locationCountryCode: string | null;  // ISO 3166-1 alpha-2 (GPS reverse-geocode) — hemisphere lens for display copy
  displayName: string;
  avatarPath: string | null;
  colorSeason: ColorSeason | null;
  personalPalette: string[];
  colorTone12: ColorTone12 | null;
  measurements: BodyMeasurements | null;
  // OTP flow state
  pendingPhone: string;
  pendingEmail: string;
  pendingAuthMethod: 'phone' | 'email' | '';
  // Lifecycle
  hydrated: boolean;

  sendOtp: (phoneInput: string, email: string) => Promise<AuthResult>;
  verifyOtp: (code: string) => Promise<AuthResult>;
  setProfile: (profile: ProfilePatch) => Promise<{ ok: boolean; message?: string }>;
  updateProfile: (patch: ProfilePatch) => Promise<{ ok: boolean; message?: string }>;
  uploadAvatar: (localUri: string) => Promise<void>;
  savePersonalColor: (result: { season: ColorSeason; palette: string[]; tone12?: ColorTone12 }) => Promise<void>;
  saveMeasurements: (m: BodyMeasurements) => Promise<void>;
  completeOnboarding: () => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  hydrate: () => Promise<void>;
}

async function hydrateProfile(set: (s: Partial<AuthState>) => void, userId: string) {
  // Always mark as logged-in when we have a valid session (non-null userId),
  // even if the profile row is temporarily unavailable (transient fetch error).
  // Profile data is best-effort; session presence is authoritative.
  set({ isLoggedIn: true });

  // Query directly (rather than via fetchMyProfile) so we can see `error`
  // separately from "no row" — profileService.fetchMyProfile collapses both
  // into `null`, which previously made a transient network/DB error look
  // identical to "user hasn't onboarded yet" and bounced an already-onboarded
  // user back to Welcome/OTP for the rest of the session.
  const [profileRes, mRow] = await Promise.all([
    sb
      .from('profiles')
      .select('id, full_name, display_name, avatar_path, email, phone, gender, date_of_birth, location_city, location_country, location_country_code, onboarding_complete, color_season, personal_palette, color_tone12')
      .eq('id', userId)
      .maybeSingle(),
    fetchMyMeasurements(userId),
  ]);

  if (profileRes.error) {
    // Transient fetch error — do NOT conclude "not onboarded". Leave the
    // in-memory profile state exactly as it was; a flaky connection must
    // never wipe an already-hydrated, onboarded user's state.
    console.warn('[authStore] hydrateProfile: profile fetch failed (transient), keeping prior state:', profileRes.error.message);
    return;
  }

  const row = profileRes.data as ProfileRow | null;
  if (!row) return; // Genuinely no row yet (e.g. race right after signup).
  set({
    onboardingComplete: row.onboarding_complete ?? false,
    phone:          row.phone || '',
    email:          row.email || '',
    gender:         row.gender || '',
    dob:            dobIsoToApp(row.date_of_birth),
    location:       joinLocation(row.location_city, row.location_country),
    locationCountryCode: row.location_country_code ?? null,
    displayName:    row.display_name || '',
    avatarPath:     row.avatar_path ?? null,
    colorSeason:    (row.color_season as ColorSeason | null) ?? null,
    personalPalette: row.personal_palette ?? [],
    colorTone12:    (row.color_tone12 as ColorTone12 | null) ?? null,
    measurements:   mRow as AuthState['measurements'],
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  onboardingComplete: false,
  phone: '',
  email: '',
  gender: '',
  dob: '',
  location: '',
  locationCountryCode: null,
  displayName: '',
  avatarPath: null,
  colorSeason: null,
  personalPalette: [],
  colorTone12: null,
  measurements: null,
  pendingPhone: '',
  pendingEmail: '',
  pendingAuthMethod: '',
  hydrated: false,

  sendOtp: async (phoneInput, email) => {
    const e164 = toE164(phoneInput);

    // Demo account — skip real SMS/email, just store pending state.
    if (e164 === DEMO_PHONE) {
      set({ pendingPhone: e164, pendingEmail: '', pendingAuthMethod: 'phone' });
      return { ok: true };
    }

    if (e164) {
      const res = await sendPhoneOtp(e164);
      if (res.ok) set({ pendingPhone: e164, pendingEmail: email.trim(), pendingAuthMethod: 'phone' });
      return res;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      if (trimmedEmail === DEMO_EMAIL) {
        set({ pendingPhone: '', pendingEmail: trimmedEmail, pendingAuthMethod: 'email' });
        return { ok: true };
      }
      const res = await sendEmailOtp(trimmedEmail);
      if (res.ok) set({ pendingPhone: '', pendingEmail: trimmedEmail, pendingAuthMethod: 'email' });
      return res;
    }
    return { ok: false, message: i18n.t('authStore_invalidPhoneOrEmail') };
  },

  verifyOtp: async (code) => {
    const { pendingPhone, pendingEmail, pendingAuthMethod } = get();
    if (!pendingPhone && !pendingEmail) return { ok: false, message: i18n.t('authStore_noVerificationInProgress') };

    // Demo account — sign into the fixed demo user (stable uid) via password.
    // That uid owns a pre-seeded wardrobe (32 items + cloud images), so the
    // OTP "000000" UX maps to a real, persistent account rather than a fresh
    // anonymous user. (Anonymous sign-in is disabled on the project.)
    const isDemo = (pendingPhone === DEMO_PHONE || pendingEmail === DEMO_EMAIL) && code === DEMO_OTP;
    if (isDemo) {
      if (!DEMO_PASSWORD) return { ok: false, message: i18n.t('authStore_demoNotConfigured') };
      const demoRes = await signInWithPassword(DEMO_EMAIL, DEMO_PASSWORD);
      if (!demoRes.ok) return { ok: false, message: i18n.t('authStore_demoSignInFailed') };
      const userId = await getCurrentUserId();
      if (!userId) return { ok: false, message: i18n.t('authStore_demoSignInFailed') };
      await Promise.all([
        markOnboardingComplete(userId),
        updateMyProfile(userId, DEMO_PROFILE),
      ]);
      await hydrateProfile(set, userId);
      set({ pendingPhone: '', pendingEmail: '', pendingAuthMethod: '' });
      return { ok: true };
    }

    const res = pendingAuthMethod === 'email'
      ? await verifyEmailOtp(pendingEmail, code)
      : await verifyPhoneOtp(pendingPhone, code);
    if (!res.ok) return res;

    // Session is live — persist phone (+ email if provided) and hydrate profile.
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, message: i18n.t('authStore_verifiedNoSession') };
    await updateMyProfile(userId, {
      // Email-OTP login must never touch `phone` — sending `phone: ''` maps
      // to `null` in profileService and would wipe an already-saved number.
      ...(pendingAuthMethod === 'email' ? {} : { phone: pendingPhone }),
      ...(pendingEmail ? { email: pendingEmail } : {}),
    });
    await hydrateProfile(set, userId);
    set({ pendingPhone: '', pendingEmail: '', pendingAuthMethod: '' });
    return { ok: true };
  },

  setProfile: async (patch) => {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, message: i18n.t('authStore_notSignedIn') };
    const res = await updateMyProfile(userId, patch);
    if (res.ok) {
      // Mirror app-shaped fields into local state for instant UI.
      const local: Partial<AuthState> = {};
      if (patch.email    !== undefined) local.email    = patch.email;
      if (patch.gender   !== undefined) local.gender   = patch.gender;
      if (patch.dob      !== undefined) local.dob      = patch.dob;
      if (patch.location !== undefined) local.location = patch.location;
      // Same normalization profileService applies on the write path.
      if (patch.locationCountryCode !== undefined) local.locationCountryCode = patch.locationCountryCode ? patch.locationCountryCode.toUpperCase() : null;
      if (Object.keys(local).length) set(local);
    }
    return res;
  },

  updateProfile: async (patch) => {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, message: i18n.t('authStore_notSignedIn') };
    const res = await updateMyProfile(userId, patch);
    if (res.ok) {
      const local: Partial<AuthState> = {};
      if (patch.email        !== undefined) local.email       = patch.email;
      if (patch.gender       !== undefined) local.gender      = patch.gender;
      if (patch.dob          !== undefined) local.dob         = patch.dob;
      if (patch.location     !== undefined) local.location    = patch.location;
      if (patch.locationCountryCode !== undefined) local.locationCountryCode = patch.locationCountryCode ? patch.locationCountryCode.toUpperCase() : null;
      if (patch.displayName  !== undefined) local.displayName = patch.displayName ?? '';
      if (patch.colorSeason  !== undefined) local.colorSeason = (patch.colorSeason as ColorSeason | null) ?? null;
      if (patch.personalPalette !== undefined) local.personalPalette = patch.personalPalette;
      if (patch.colorTone12  !== undefined) local.colorTone12 = (patch.colorTone12 as ColorTone12 | null) ?? null;
      if (Object.keys(local).length) set(local);
    }
    return res;
  },

  uploadAvatar: async (localUri) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error(i18n.t('authStore_notSignedIn'));
    const { avatarPath: currentPath } = get();
    const { avatarPath } = await svcUploadAvatar(userId, localUri, currentPath);
    set({ avatarPath });
  },

  savePersonalColor: async (result) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await updateMyProfile(userId, {
      colorSeason: result.season,
      personalPalette: result.palette,
      ...(result.tone12 !== undefined ? { colorTone12: result.tone12 } : {}),
    });
    set({
      colorSeason: result.season,
      personalPalette: result.palette,
      ...(result.tone12 !== undefined ? { colorTone12: result.tone12 } : {}),
    });
  },

  saveMeasurements: async (m) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const result = await upsertMyMeasurements(userId, m as import('../types/fitEngine').BodyMeasurements);
    set({ measurements: m });
    // Mirror to fitEngineStore so the fit engine has fresh data immediately
    // without waiting for the next hydrate(). fitEngineStore is already
    // imported above (used by logout/deleteAccount), so no lazy require needed.
    // We update in-memory state only — no second DB write.
    useFitEngineStore.setState({ bodyMeasurements: m as import('../types/fitEngine').BodyMeasurements });
    // Optimistic — local state above stays even on failure (no rollback, same
    // rationale as fitEngineStore.setBodyMeasurements: rollback would flicker
    // the UI back to stale values). What was missing is that upsertMyMeasurements'
    // `{ ok: false }` result used to be read and discarded right here, so a
    // failed Supabase write left the client and server silently diverged and
    // useMeasurements.save()'s catch path (app/(onboarding)/measurements.tsx's
    // Alert + inline error text) never fired. Reuses fitEngineStore's key —
    // same failure mode, same message, no need for a near-duplicate string.
    if (!result.ok) throw new Error(result.message ?? i18n.t('fitEngineStore_syncFailed'));
  },

  completeOnboarding: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, message: i18n.t('authStore_notSignedIn') };
    const res = await markOnboardingComplete(userId);
    if (res.ok) set({ onboardingComplete: true });
    return res;
  },

  logout: async () => {
    await signOut();
    // Clear private body/style data and server-sourced app state before wiping auth.
    useFitEngineStore.getState().reset();
    useAppStore.getState().resetUserState();
    set({
      isLoggedIn: false, onboardingComplete: false,
      phone: '', email: '', gender: '', dob: '', location: '', locationCountryCode: null,
      displayName: '', avatarPath: null, colorSeason: null, personalPalette: [], colorTone12: null, measurements: null,
      pendingPhone: '', pendingEmail: '', pendingAuthMethod: '',
    });
  },

  deleteAccount: async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error(i18n.t('authStore_notSignedIn'));
    const { error } = await sb.functions.invoke('delete-user', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) throw new Error(error.message ?? i18n.t('settings_deleteAccountError'));
    // Clear private body/style data and server-sourced app state before wiping auth.
    useFitEngineStore.getState().reset();
    useAppStore.getState().resetUserState();
    // Clear local session after successful deletion
    await signOut();
    set({
      isLoggedIn: false, onboardingComplete: false,
      phone: '', email: '', gender: '', dob: '', location: '', locationCountryCode: null,
      displayName: '', avatarPath: null, colorSeason: null, personalPalette: [], colorTone12: null, measurements: null,
      pendingPhone: '', pendingEmail: '', pendingAuthMethod: '',
    });
  },

  hydrate: () => {
    // In-flight guard: a second concurrent call reuses the same promise
    // instead of racing an independent run against it.
    if (_hydrateInFlight) return _hydrateInFlight;

    const run = async () => {
      let resolvedUid: string | null = null;
      try {
        // Bounded: a stalled (not outright failed) network call must never
        // leave `hydrated` false forever and strand the app behind the splash
        // screen — timeout falls back to "no session", same as a real error.
        const userId = await withTimeout(getCurrentUserId(), HYDRATE_TIMEOUT_MS, null);
        resolvedUid = userId;
        if (userId) await withTimeout(hydrateProfile(set, userId), HYDRATE_TIMEOUT_MS, undefined);
      } catch (err) {
        console.warn('[authStore] hydrate failed:', err);
      } finally {
        set({ hydrated: true });
      }

      // Keep state in sync with auth changes (sign-in, token refresh, sign-out).
      // Guard ensures this listener is registered exactly once per app process.
      if (!_authListenerRegistered) {
        _authListenerRegistered = true;
        // Seed with the uid already hydrated above (if any) so the immediate
        // INITIAL_SESSION event this listener receives right on subscribe
        // doesn't re-fetch the same profile a second time (cold-start
        // double-fetch: hydrate() already loaded it directly, above).
        let lastAuthedUid: string | null = resolvedUid;
        sb.auth.onAuthStateChange((_event, session) => {
          // Fire-and-forget: this callback must NOT be async/await a Supabase
          // call directly — supabase-js warns this can deadlock its internal
          // auth lock. Dedupe by uid so routine TOKEN_REFRESHED events (same
          // user) don't refetch the profile every time.
          const uid = session?.user?.id ?? null;
          if (uid) {
            if (uid !== lastAuthedUid) {
              lastAuthedUid = uid;
              hydrateProfile(set, uid).catch((err) => {
                console.warn('[authStore] onAuthStateChange hydrateProfile failed:', err);
              });
            }
          } else {
            lastAuthedUid = null;
            // Wipe private body/style data before clearing auth identity.
            useFitEngineStore.getState().reset();
            useAppStore.getState().resetUserState();
            set({
              isLoggedIn: false, onboardingComplete: false,
              phone: '', email: '', gender: '', dob: '', location: '', locationCountryCode: null,
              displayName: '', avatarPath: null, colorSeason: null, personalPalette: [], colorTone12: null, measurements: null,
            });
          }
        });
      }
    };

    _hydrateInFlight = run().finally(() => { _hydrateInFlight = null; });
    return _hydrateInFlight;
  },
}));
