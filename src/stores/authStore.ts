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
  toE164, getCurrentUserId, signOut,
  type AuthResult,
} from '../services/authService';
import {
  fetchMyMeasurements, upsertMyMeasurements,
} from '../services/measurementService';
import type { BodyMeasurements } from '../types/measurements';
import {
  fetchMyProfile, updateMyProfile, markOnboardingComplete,
  uploadAvatar as svcUploadAvatar,
  dobIsoToApp, joinLocation,
  type ProfilePatch,
} from '../services/profileService';
import type { ColorSeason } from '../types/profile';
import { sb } from '../services/supabase';
import { DEMO_PHONE, DEMO_EMAIL, DEMO_OTP, DEMO_PROFILE } from '../config/demo';

interface AuthState {
  isLoggedIn: boolean;
  onboardingComplete: boolean;
  // Profile fields (app-shape)
  phone: string;
  email: string;
  gender: string;
  dob: string;       // "DD/MM/YYYY"
  location: string;  // "City, Country"
  displayName: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  colorSeason: ColorSeason | null;
  personalPalette: string[];
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
  savePersonalColor: (result: { season: ColorSeason; palette: string[] }) => Promise<void>;
  saveMeasurements: (m: BodyMeasurements) => Promise<void>;
  completeOnboarding: () => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  hydrate: () => Promise<void>;
}

async function hydrateProfile(set: (s: Partial<AuthState>) => void, userId: string) {
  const [row, mRow] = await Promise.all([
    fetchMyProfile(userId),
    fetchMyMeasurements(userId),
  ]);
  if (!row) return;
  set({
    isLoggedIn: true,
    onboardingComplete: row.onboarding_complete ?? false,
    phone:          row.phone || '',
    email:          row.email || '',
    gender:         row.gender || '',
    dob:            dobIsoToApp(row.date_of_birth),
    location:       joinLocation(row.location_city, row.location_country),
    displayName:    row.display_name || '',
    avatarUrl:      row.avatar_url ?? null,
    avatarPath:     row.avatar_path ?? null,
    colorSeason:    (row.color_season as ColorSeason | null) ?? null,
    personalPalette: row.personal_palette ?? [],
    measurements:   mRow as import('./authStore').AuthState['measurements'],
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
  displayName: '',
  avatarUrl: null,
  avatarPath: null,
  colorSeason: null,
  personalPalette: [],
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
    return { ok: false, message: 'Please enter a valid phone number or email.' };
  },

  verifyOtp: async (code) => {
    const { pendingPhone, pendingEmail, pendingAuthMethod } = get();
    if (!pendingPhone && !pendingEmail) return { ok: false, message: 'No verification in progress.' };

    // Demo account — sign in anonymously and seed a pre-built profile.
    const isDemo = (pendingPhone === DEMO_PHONE || pendingEmail === DEMO_EMAIL) && code === DEMO_OTP;
    if (isDemo) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) return { ok: false, message: 'Demo sign-in failed.' };
      const userId = await getCurrentUserId();
      if (!userId) return { ok: false, message: 'Demo sign-in failed.' };
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
    if (!userId) return { ok: false, message: 'Verified but no session — please retry.' };
    await updateMyProfile(userId, {
      phone: pendingPhone,
      ...(pendingEmail ? { email: pendingEmail } : {}),
    });
    await hydrateProfile(set, userId);
    set({ pendingPhone: '', pendingEmail: '', pendingAuthMethod: '' });
    return { ok: true };
  },

  setProfile: async (patch) => {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, message: 'Not signed in.' };
    const res = await updateMyProfile(userId, patch);
    if (res.ok) {
      // Mirror app-shaped fields into local state for instant UI.
      const local: Partial<AuthState> = {};
      if (patch.email    !== undefined) local.email    = patch.email;
      if (patch.gender   !== undefined) local.gender   = patch.gender;
      if (patch.dob      !== undefined) local.dob      = patch.dob;
      if (patch.location !== undefined) local.location = patch.location;
      if (Object.keys(local).length) set(local);
    }
    return res;
  },

  updateProfile: async (patch) => {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, message: 'Not signed in.' };
    const res = await updateMyProfile(userId, patch);
    if (res.ok) {
      const local: Partial<AuthState> = {};
      if (patch.email        !== undefined) local.email       = patch.email;
      if (patch.gender       !== undefined) local.gender      = patch.gender;
      if (patch.dob          !== undefined) local.dob         = patch.dob;
      if (patch.location     !== undefined) local.location    = patch.location;
      if (patch.displayName  !== undefined) local.displayName = patch.displayName ?? '';
      if (patch.colorSeason  !== undefined) local.colorSeason = (patch.colorSeason as ColorSeason | null) ?? null;
      if (patch.personalPalette !== undefined) local.personalPalette = patch.personalPalette;
      if (Object.keys(local).length) set(local);
    }
    return res;
  },

  uploadAvatar: async (localUri) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not signed in.');
    const { avatarPath: currentPath } = get();
    const { avatarUrl, avatarPath } = await svcUploadAvatar(userId, localUri, currentPath);
    set({ avatarUrl, avatarPath });
  },

  savePersonalColor: async (result) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await updateMyProfile(userId, { colorSeason: result.season, personalPalette: result.palette });
    set({ colorSeason: result.season, personalPalette: result.palette });
  },

  saveMeasurements: async (m) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await upsertMyMeasurements(userId, m as import('../types/fitEngine').BodyMeasurements);
    set({ measurements: m });
  },

  completeOnboarding: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, message: 'Not signed in.' };
    const res = await markOnboardingComplete(userId);
    if (res.ok) set({ onboardingComplete: true });
    return res;
  },

  logout: async () => {
    await signOut();
    set({
      isLoggedIn: false, onboardingComplete: false,
      phone: '', email: '', gender: '', dob: '', location: '',
      displayName: '', avatarUrl: null, avatarPath: null, colorSeason: null, personalPalette: [], measurements: null,
      pendingPhone: '', pendingEmail: '', pendingAuthMethod: '',
    });
  },

  deleteAccount: async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Not signed in.');
    const { error } = await sb.functions.invoke('delete-user', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) throw new Error(error.message ?? 'Account deletion failed.');
    // Clear local session after successful deletion
    await signOut();
    set({
      isLoggedIn: false, onboardingComplete: false,
      phone: '', email: '', gender: '', dob: '', location: '',
      displayName: '', avatarUrl: null, avatarPath: null, colorSeason: null, personalPalette: [], measurements: null,
      pendingPhone: '', pendingEmail: '', pendingAuthMethod: '',
    });
  },

  hydrate: async () => {
    try {
      const userId = await getCurrentUserId();
      if (userId) await hydrateProfile(set, userId);
    } catch (err) {
      console.warn('[authStore] hydrate failed:', err);
    } finally {
      set({ hydrated: true });
    }

    // Keep state in sync with auth changes (sign-in, token refresh, sign-out).
    sb.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.id) {
        await hydrateProfile(set, session.user.id);
      } else {
        set({
          isLoggedIn: false, onboardingComplete: false,
          phone: '', email: '', gender: '', dob: '', location: '',
          displayName: '', avatarUrl: null, avatarPath: null, colorSeason: null, personalPalette: [], measurements: null,
        });
      }
    });
  },
}));
