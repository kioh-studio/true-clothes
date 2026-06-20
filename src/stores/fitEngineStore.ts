import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BodyMeasurements, UserStyleProfile, ScoredOutfit, IntentContext } from '../types/fitEngine';
import { ScannedItem } from '../types/tryOn';
import { getCurrentUserId } from '../services/authService';
import { fetchMyMeasurements, upsertMyMeasurements } from '../services/measurementService';
import { fetchMyStyleProfile, upsertMyStyleProfile } from '../services/styleProfileService';
import { fetchStyles, StyleCatalogItem } from '../services/stylesCatalogService';
import { fetchFormulas, FormulaCatalogItem } from '../services/formulasCatalogService';
import { sb } from '../services/supabase';
import i18n from '../i18n';
import { useAppStore } from './appStore';
import { logImpressions } from '../services/outfitInteractionService';

const EMPTY_BODY: BodyMeasurements = {};
const SHOWN_IDS_KEY = 'shown-outfit-ids';
const CURATED_DATE_KEY = 'last-curated-date';

// Pseudo-id for shown/excluded outfits — the FULL slot set, matching the
// server's exclude semantics. Two outfits that share items but differ in
// outerwear/accessory are distinct (duplicate items OK, duplicate full
// outfit not), so the key must include every slot, not just the core triple.
const outfitKey = (o: ScoredOutfit) =>
  [o.slots.top, o.slots.bottom, o.slots.shoes, o.slots.outwear ?? '', o.slots.accessory ?? ''].join('|');

// Live weather → engine season, so suggestions match what's outside the window.
const BAND_TO_SEASON: Record<string, 'winter' | 'fall' | 'spring' | 'summer'> = {
  cold: 'winter', mild: 'fall', warm: 'spring', hot: 'summer',
};

function weatherIntent(intent?: IntentContext): IntentContext | undefined {
  const band = useAppStore.getState().weatherContext?.temperatureBand;
  const season = band ? BAND_TO_SEASON[band] : undefined;
  if (!season) return intent;
  return { ...intent, seasonOverride: intent?.seasonOverride ?? season };
}

// Curation gating: premium users get every batch curated; free users get one
// curated batch per day (the daily "stylist moment" that sells the upgrade).
async function resolveCurateFlag(premium: boolean): Promise<boolean> {
  if (premium) return true;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const last = await AsyncStorage.getItem(CURATED_DATE_KEY);
    if (last === today) return false;
    await AsyncStorage.setItem(CURATED_DATE_KEY, today);
    return true;
  } catch {
    return false;
  }
}

interface FitEngineState {
  bodyMeasurements: BodyMeasurements;
  styleProfile: UserStyleProfile;
  colorPreferences: string[];
  hydrated: boolean;

  // Catalog (T043)
  styles: StyleCatalogItem[];
  formulas: FormulaCatalogItem[];
  sessionFormulaId: string | null;
  loadCatalogs: () => Promise<void>;
  setSessionFormula: (id: string | null) => void;

  // Persistent formula preferences (server-side in style_profiles)
  formulaPreferences: string[];
  setFormulaPreferences: (ids: string[]) => Promise<void>;

  // Premium tier — set by UI (usePremium); gates curated batches for free users
  premium: boolean;
  setPremium: (premium: boolean) => void;

  // Feed outfits + pagination (T061)
  outfits: ScoredOutfit[];
  shownOutfitIds: string[];
  isFetchingMore: boolean;
  feedError: boolean;

  setBodyMeasurements: (m: Partial<BodyMeasurements>) => Promise<void>;
  setStyleProfile: (p: Partial<UserStyleProfile>) => Promise<void>;
  setColorPreferences: (colors: string[]) => Promise<void>;
  addSelectedStyle: (styleId: string) => Promise<void>;
  removeSelectedStyle: (styleId: string) => Promise<void>;

  fetchOutfits: (opts?: { intent?: IntentContext; excludeIds?: string[] }) => Promise<ScoredOutfit[]>;
  fetchMoreOutfits: () => Promise<void>;

  // Try On / Mix & Match (feature 008): outfits built around a transient scanned
  // item, pinned into every result. Does NOT touch the feed state or consume a
  // credit; the Verdict and the daily feed are independent of this.
  fetchMixMatchOutfits: (scannedItem: ScannedItem) => Promise<ScoredOutfit[]>;

  hydrate: () => Promise<void>;
}

export const useFitEngineStore = create<FitEngineState>((set, get) => ({
  bodyMeasurements: { ...EMPTY_BODY },
  styleProfile: { selectedStyles: [] },
  colorPreferences: [],
  hydrated: false,

  // Catalog
  styles: [],
  formulas: [],
  sessionFormulaId: null,

  loadCatalogs: async () => {
    try {
      const [styles, formulas] = await Promise.all([fetchStyles(), fetchFormulas()]);
      set({ styles, formulas });
    } catch (err) {
      console.warn('[fitEngineStore] loadCatalogs failed:', err);
    }
  },

  setSessionFormula: (id) => set({ sessionFormulaId: id }),

  formulaPreferences: [],
  setFormulaPreferences: async (ids) => {
    set({ formulaPreferences: ids });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyStyleProfile(userId, { formulaPreferences: ids });
  },

  premium: false,
  setPremium: (premium) => {
    const wasPremium = get().premium;
    set({ premium });
    // On free→premium upgrade, migrate existing on-device photos to the cloud
    // (feature 003-upload-image, US3 / FR-011). Reuses the pending-upload sync.
    if (premium && !wasPremium) {
      useAppStore.getState().syncPendingPhotos().catch(() => {});
    }
  },

  // Feed
  outfits: [],
  shownOutfitIds: [],
  isFetchingMore: false,
  feedError: false,

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

  fetchOutfits: async (opts = {}) => {
    const { intent, excludeIds } = opts;
    const { shownOutfitIds, sessionFormulaId, premium } = get();
    set({ feedError: false });

    const allExclude = [...shownOutfitIds, ...(excludeIds ?? [])];
    const effectiveIntent = weatherIntent(intent);
    const curate = await resolveCurateFlag(premium);
    const body: Record<string, unknown> = {
      ...(effectiveIntent ? { intent: effectiveIntent } : {}),
      ...(allExclude.length ? { exclude_ids: allExclude } : {}),
      ...(sessionFormulaId ? { formula_id: sessionFormulaId } : {}),
      locale: i18n.language?.startsWith('vi') ? 'vi' : 'en',
      curate,
    };

    const { data, error } = await sb.functions.invoke('generate-outfits', { body });
    if (error) {
      console.warn('[fitEngineStore] fetchOutfits failed:', error);
      set({ feedError: true });
      return [];
    }

    const response = data as { outfits: ScoredOutfit[]; curated?: boolean };
    const newOutfits = response.outfits ?? [];
    const newIds = newOutfits.map(outfitKey);

    // Behavior events (Q18): record what the feed showed, tagged curated/rule
    logImpressions(newOutfits.map((o, i) => ({
      outfitId: outfitKey(o), curated: response.curated ?? false, formula: o.formula, position: i,
    }))).catch(() => {});

    // If server returned < 3, flush shown IDs for a fresh cycle
    if (newOutfits.length < 3) {
      set({ outfits: newOutfits, shownOutfitIds: [] });
      AsyncStorage.removeItem(SHOWN_IDS_KEY).catch(() => {});
    } else {
      const nextShown = [...shownOutfitIds, ...newIds];
      set({ outfits: newOutfits, shownOutfitIds: nextShown });
      AsyncStorage.setItem(SHOWN_IDS_KEY, JSON.stringify(nextShown)).catch(() => {});
    }
    return newOutfits;
  },

  fetchMixMatchOutfits: async (scannedItem) => {
    const meta = scannedItem.metadata;
    // Build the transient pin_item from the scanned garment's controlled-vocab
    // metadata. measurements already use the m_* keys the engine expects.
    const pin_item: Record<string, unknown> = {
      id: scannedItem.id,            // "scanned" — client maps it back to the cut-out image
      type: meta.type,
      color: meta.color,
      ...(meta.material ? { material: meta.material } : {}),
      ...(meta.fit ? { fit: meta.fit } : {}),
      ...(meta.pattern ? { pattern: meta.pattern } : {}),
      ...(meta.warmthSeason ? { warmth_season: meta.warmthSeason } : {}),
      ...(meta.measurements && Object.keys(meta.measurements).length
        ? { measurements: meta.measurements }
        : {}),
    };

    const effectiveIntent = weatherIntent();
    const body: Record<string, unknown> = {
      pin_item,
      ...(effectiveIntent ? { intent: effectiveIntent } : {}),
      locale: i18n.language?.startsWith('vi') ? 'vi' : 'en',
      curate: false, // deterministic pairing; no LLM curation / no credit
    };

    const { data, error } = await sb.functions.invoke('generate-outfits', { body });
    if (error) {
      console.warn('[fitEngineStore] fetchMixMatchOutfits failed:', error);
      throw error instanceof Error ? error : new Error('Mix & match failed');
    }
    const response = data as { outfits?: ScoredOutfit[] };
    return response.outfits ?? [];
  },

  fetchMoreOutfits: async () => {
    if (get().isFetchingMore) return;
    set({ isFetchingMore: true });
    const { shownOutfitIds, sessionFormulaId } = get();
    try {
      const effectiveIntent = weatherIntent();
      const curate = await resolveCurateFlag(get().premium);
      const body: Record<string, unknown> = {
        exclude_ids: shownOutfitIds,
        ...(effectiveIntent ? { intent: effectiveIntent } : {}),
        ...(sessionFormulaId ? { formula_id: sessionFormulaId } : {}),
        locale: i18n.language?.startsWith('vi') ? 'vi' : 'en',
        curate,
      };
      const { data } = await sb.functions.invoke('generate-outfits', { body });
      const response = data as { outfits: ScoredOutfit[]; curated?: boolean };
      const newOutfits = response.outfits ?? [];
      const newIds = newOutfits.map(outfitKey);

      logImpressions(newOutfits.map((o, i) => ({
        outfitId: outfitKey(o), curated: response.curated ?? false, formula: o.formula, position: i,
      }))).catch(() => {});
      set(s => ({
        outfits: [...s.outfits, ...newOutfits],
        shownOutfitIds: [...s.shownOutfitIds, ...newIds],
      }));
    } catch (err) {
      console.warn('[fitEngineStore] fetchMoreOutfits failed:', err);
    } finally {
      set({ isFetchingMore: false });
    }
  },

  hydrate: async () => {
    try {
      // Restore shown IDs from storage
      const raw = await AsyncStorage.getItem(SHOWN_IDS_KEY);
      if (raw) set({ shownOutfitIds: JSON.parse(raw) });

      const userId = await getCurrentUserId();
      if (userId) {
        const [measurements, styleData] = await Promise.all([
          fetchMyMeasurements(userId),
          fetchMyStyleProfile(userId),
        ]);
        set({
          bodyMeasurements: measurements ?? { ...EMPTY_BODY },
          styleProfile:     { selectedStyles: styleData?.selectedStyles ?? [] },
          colorPreferences: styleData?.colorPreferences ?? [],
          formulaPreferences: styleData?.formulaPreferences ?? [],
        });
      }
    } catch (err) {
      console.warn('[fitEngineStore] hydrate failed:', err);
    } finally {
      set({ hydrated: true });
    }
  },
}));
