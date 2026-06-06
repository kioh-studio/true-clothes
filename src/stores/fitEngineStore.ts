// Fit engine store — Supabase-backed.
//
// Persists body measurements to `public.body_measurements` and style/color/
// formula preferences to `public.style_profiles` via service modules.
// Keeps a hydrated in-memory copy for fast UI reads.
//
// Engine computation is now server-side (generate-outfits Edge Function).
// Per CLAUDE.md: no Supabase calls here — always via service abstractions.
import { create } from 'zustand';
import { BodyMeasurements, UserStyleProfile, ScoredOutfit, IntentContext } from '../types/fitEngine';
import { getCurrentUserId } from '../services/authService';
import { fetchMyMeasurements, upsertMyMeasurements } from '../services/measurementService';
import { fetchMyStyleProfile, upsertMyStyleProfile } from '../services/styleProfileService';
import { sb } from '../services/supabase';

const EMPTY_BODY: BodyMeasurements = {};

interface FitEngineState {
  bodyMeasurements: BodyMeasurements;
  styleProfile: UserStyleProfile;
  colorPreferences: string[];
  hydrated: boolean;

  setBodyMeasurements: (m: Partial<BodyMeasurements>) => Promise<void>;
  setStyleProfile: (p: Partial<UserStyleProfile>) => Promise<void>;
  setColorPreferences: (colors: string[]) => Promise<void>;
  addSelectedStyle: (styleId: string) => Promise<void>;
  removeSelectedStyle: (styleId: string) => Promise<void>;

  /** Call the generate-outfits Edge Function */
  fetchOutfits: (intent?: IntentContext) => Promise<ScoredOutfit[]>;

  hydrate: () => Promise<void>;
}

export const useFitEngineStore = create<FitEngineState>((set, get) => ({
  bodyMeasurements: { ...EMPTY_BODY },
  styleProfile: { selectedStyles: [] },
  colorPreferences: [],
  hydrated: false,

  setBodyMeasurements: async (m) => {
    const nextBody = { ...get().bodyMeasurements, ...m };
    set({ bodyMeasurements: nextBody });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyMeasurements(userId, nextBody);
  },

  setStyleProfile: async (p) => {
    const nextProfile = { ...get().styleProfile, ...p };
    set({ styleProfile: nextProfile });
    const userId = await getCurrentUserId();
    if (userId) {
      await upsertMyStyleProfile(userId, {
        selectedStyles: nextProfile.selectedStyles,
      });
    }
  },

  setColorPreferences: async (colors) => {
    set({ colorPreferences: colors });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyStyleProfile(userId, { colorPreferences: colors });
  },

  addSelectedStyle: async (styleId) => {
    const existing = get().styleProfile.selectedStyles.filter(id => id !== styleId);
    const nextStyles = [...existing, styleId];
    const nextProfile = { ...get().styleProfile, selectedStyles: nextStyles };
    set({ styleProfile: nextProfile });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyStyleProfile(userId, { selectedStyles: nextStyles });
  },

  removeSelectedStyle: async (styleId) => {
    const nextStyles = get().styleProfile.selectedStyles.filter(id => id !== styleId);
    const nextProfile = { ...get().styleProfile, selectedStyles: nextStyles };
    set({ styleProfile: nextProfile });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyStyleProfile(userId, { selectedStyles: nextStyles });
  },

  fetchOutfits: async (intent) => {
    const { data, error } = await sb.functions.invoke('generate-outfits', {
      body: intent ? { intent } : {},
    });
    if (error) {
      console.warn('[fitEngineStore] fetchOutfits failed:', error);
      return [];
    }
    return (data as { outfits: ScoredOutfit[] }).outfits ?? [];
  },

  hydrate: async () => {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const [measurements, styleData] = await Promise.all([
          fetchMyMeasurements(userId),
          fetchMyStyleProfile(userId),
        ]);
        set({
          bodyMeasurements:   measurements ?? { ...EMPTY_BODY },
          styleProfile:       { selectedStyles: styleData?.selectedStyles ?? [] },
          colorPreferences:   styleData?.colorPreferences ?? [],
        });
      }
    } catch (err) {
      console.warn('[fitEngineStore] hydrate failed:', err);
    } finally {
      set({ hydrated: true });
    }
  },
}));
