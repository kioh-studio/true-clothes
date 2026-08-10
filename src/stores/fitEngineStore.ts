import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BodyMeasurements, UserStyleProfile, ScoredOutfit, IntentContext, GenerateOutfitsResponse } from '../types/fitEngine';
import type { EstimatedMeasurements } from '../types/measurements';
import { ScannedItem } from '../types/tryOn';
import { getCurrentUserId } from '../services/authService';
import { fetchMyMeasurements, upsertMyMeasurements } from '../services/measurementService';
import { fetchMyStyleProfile, upsertMyStyleProfile, ShapeGoal } from '../services/styleProfileService';
import { fetchStyles, StyleCatalogItem } from '../services/stylesCatalogService';
import { fetchFormulas, FormulaCatalogItem } from '../services/formulasCatalogService';
import { sb } from '../services/supabase';
import i18n from '../i18n';
import { useAppStore } from './appStore';
import { logImpressions } from '../services/outfitInteractionService';

const EMPTY_BODY: BodyMeasurements = {};
const SHOWN_IDS_KEY = 'shown-outfit-ids';
// Feed-signals (2026-08-07): swipe-left dismissed outfit ids, persisted
// separately from shownOutfitIds. Deliberately NOT flushed on the "server
// returned < 3 → fresh cycle" path (unlike shownOutfitIds) — a dismiss is a
// standing "not this" the user gave us, not a pagination bookkeeping detail,
// so it should keep suppressing that outfit across cycles, capped at the
// most recent 200 so the exclude_ids payload stays bounded as history grows.
const DISMISSED_IDS_KEY = 'dismissed-outfit-ids';
const DISMISSED_IDS_CAP = 200;

// Register the onAuthStateChange listener exactly once per app process.
// Without this, Fast Refresh / remount / re-hydrate calls stack duplicate
// listeners that each refetch on every auth event.
let _fitAuthListenerRegistered = false;
const CURATED_DATE_KEY = 'last-curated-date';

// Pseudo-id for shown/excluded outfits — the FULL slot set, matching the
// server's exclude semantics. Two outfits that share items but differ in
// outerwear/accessory/mid are distinct (duplicate items OK, duplicate full
// outfit not), so the key must include every slot, not just the core triple.
// `mid` (2026-08-10, layer worn under a true outer) appended last, matching
// engine/index.ts's exclude-key `full` and useFitFeed.ts's `fullKey`.
const outfitKey = (o: ScoredOutfit) =>
  [o.slots.top, o.slots.bottom, o.slots.shoes, o.slots.outwear ?? '', o.slots.accessory ?? '', o.slots.mid ?? ''].join('|');

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

// Local-date (device timezone) YYYY-MM-DD — NOT toISOString(), which is UTC
// and misreports "today" during the UTC+7 morning window (00:00–07:00 local
// falls on the previous UTC calendar day, resetting the daily curate flag
// 7 hours early/late depending on direction).
function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Per-user key: without the userId suffix, switching accounts on the same
// device would inherit whatever "already curated today" state the previous
// user left behind (or vice versa).
function curatedDateKey(userId: string | null): string {
  return userId ? `${CURATED_DATE_KEY}:${userId}` : CURATED_DATE_KEY;
}

// Curation gating: premium users get every batch curated; free users get one
// curated batch per day (the daily "stylist moment" that sells the upgrade).
// Read-only decision — does NOT write the "used" flag. Call markCurateUsedToday()
// only after the generate-outfits call actually succeeds (and only if the
// server confirms it curated), so a failed/degraded fetch never burns a free
// user's daily curate slot.
async function shouldCurateToday(premium: boolean, userId: string | null): Promise<boolean> {
  if (premium) return true;
  try {
    const last = await AsyncStorage.getItem(curatedDateKey(userId));
    return last !== localDateKey();
  } catch {
    return false;
  }
}

async function markCurateUsedToday(userId: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(curatedDateKey(userId), localDateKey());
  } catch {
    // Best-effort — a failed write just risks one extra curated batch today,
    // not a correctness issue.
  }
}

interface FitEngineState {
  bodyMeasurements: BodyMeasurements;
  styleProfile: UserStyleProfile;
  colorPreferences: string[];
  hydrated: boolean;

  // Wipe all user-personal data on sign-out so a new user never sees stale private state.
  reset: () => void;

  // Catalog (T043)
  styles: StyleCatalogItem[];
  formulas: FormulaCatalogItem[];
  sessionFormulaId: string | null;
  loadCatalogs: () => Promise<void>;
  setSessionFormula: (id: string | null) => void;

  // Persistent formula preferences (server-side in style_profiles)
  formulaPreferences: string[];
  setFormulaPreferences: (ids: string[]) => Promise<void>;

  // 4 suggestion toggles (2026-08-10): independent opt-outs for individual
  // outfit-suggestion dimensions, persisted server-side in style_profiles
  // (same table/row as formulaPreferences above — same hydrate/persist
  // pattern). All default true (unchanged behavior for existing users).
  suggestByStyle: boolean;
  suggestByPersonalColor: boolean;
  suggestByFormula: boolean;
  suggestByMeasurements: boolean;
  setSuggestionToggles: (patch: Partial<{
    suggestByStyle: boolean;
    suggestByPersonalColor: boolean;
    suggestByFormula: boolean;
    suggestByMeasurements: boolean;
  }>) => Promise<void>;

  // Shape goal (010-wardrobe-critic follow-up, 2026-08-10): the user's
  // durable "desired resulting body silhouette" choice, persisted server-side
  // in style_profiles (same table/row as formulaPreferences/suggestion
  // toggles above — same hydrate/persist pattern). Default 'auto' (unchanged
  // behavior). Consumed by generate-outfits directly off style_profiles —
  // there is no per-request body field to thread (mirrors the 4 suggestion
  // toggles' own note on this, see plan.md).
  shapeGoal: ShapeGoal;
  setShapeGoal: (goal: ShapeGoal) => Promise<void>;

  // Premium tier — set by UI (usePremium); gates curated batches for free users
  premium: boolean;
  setPremium: (premium: boolean) => void;

  // Feed outfits + pagination (T061)
  outfits: ScoredOutfit[];
  shownOutfitIds: string[];
  isFetchingMore: boolean;
  feedError: boolean;

  // Swipe-left dismissed outfit ids (feed-signals, 2026-08-07). Merged into
  // exclude_ids alongside shownOutfitIds so a dismissed outfit never comes
  // back into the feed, but persisted/capped independently — see
  // DISMISSED_IDS_KEY above for why it survives a shownOutfitIds flush.
  dismissedOutfitIds: string[];
  addDismissedOutfit: (outfitId: string) => void;

  // Wardrobe-affinity style fallback envelope (2026-08-02): mirrors the
  // top-level `style_fallback.styles` the server sends only when the user has
  // no selected styles and it auto-picked fallback styles from wardrobe
  // coverage (see generate-outfits `styleFallback`). Display-only feed hint —
  // null when absent. Set on the main feed fetch + refresh paths only, NOT on
  // Mix & Match (fetchMixMatchOutfits never touches the feed state).
  styleFallback: Array<{ id: string; name: string }> | null;

  // Mirrors the last fetch's `response.curated` (feed-signals, 2026-08-07) —
  // read by the feed screen to tag `viewed`/`dismissed` outfit_interactions
  // rows with the same curated/formula/position shape `logImpressions` uses,
  // for LLM-curated vs rule-only analytics comparisons. Best-effort/display
  // metadata only — never read back by the taste engine (which only parses
  // outfit_id), so a stale value here can't affect ranking.
  lastCurated: boolean;

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

  // Pose-estimation pre-fill (measurements AI scan):
  // Set by measurements-scan.tsx after successful on-device inference;
  // consumed + cleared by measurements-edit.tsx and onboarding/measurements.tsx
  // via useEffect. Ephemeral: not persisted, wiped on reset().
  pendingEstimate: EstimatedMeasurements | null;
  setPendingEstimate: (est: EstimatedMeasurements | null) => void;

  hydrate: () => Promise<void>;
}

export const useFitEngineStore = create<FitEngineState>((set, get) => ({
  bodyMeasurements: { ...EMPTY_BODY },
  styleProfile: { selectedStyles: [] },
  colorPreferences: [],
  hydrated: false,
  pendingEstimate: null,

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

  setPendingEstimate: (est) => set({ pendingEstimate: est }),

  setSessionFormula: (id) => set({ sessionFormulaId: id }),

  formulaPreferences: [],
  setFormulaPreferences: async (ids) => {
    set({ formulaPreferences: ids });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyStyleProfile(userId, { formulaPreferences: ids });
  },

  suggestByStyle: true,
  suggestByPersonalColor: true,
  suggestByFormula: true,
  suggestByMeasurements: true,
  setSuggestionToggles: async (patch) => {
    set(patch);
    const userId = await getCurrentUserId();
    if (userId) await upsertMyStyleProfile(userId, patch);
  },

  shapeGoal: 'auto',
  setShapeGoal: async (goal) => {
    set({ shapeGoal: goal });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyStyleProfile(userId, { shapeGoal: goal });
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
  styleFallback: null,
  lastCurated: false,

  dismissedOutfitIds: [],
  addDismissedOutfit: (outfitId) => {
    const next = [...get().dismissedOutfitIds.filter(id => id !== outfitId), outfitId].slice(-DISMISSED_IDS_CAP);
    set({ dismissedOutfitIds: next });
    AsyncStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(next)).catch(() => {});
  },

  setBodyMeasurements: async (m) => {
    const nextBody = { ...get().bodyMeasurements, ...m };
    set({ bodyMeasurements: nextBody });
    const userId = await getCurrentUserId();
    if (userId) await upsertMyMeasurements(userId, nextBody);
    // Mirror to authStore so try-on (wear.tsx) and any other authStore.measurements
    // reader sees fresh data immediately — without a second DB write.
    // Lazy require avoids a circular module reference at evaluation time
    // (authStore already imports fitEngineStore for reset()).
    // We merge rather than replace so authStore-only fields (bodyShape,
    // measurementsConsent, poseEstimated) set during onboarding are preserved.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('./authStore') as typeof import('./authStore');
    useAuthStore.setState((s) => ({
      measurements: {
        ...s.measurements,
        ...nextBody,
      } as import('../types/measurements').BodyMeasurements,
    }));
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
    const { shownOutfitIds, dismissedOutfitIds, sessionFormulaId, premium } = get();
    set({ feedError: false });

    const allExclude = [...shownOutfitIds, ...dismissedOutfitIds, ...(excludeIds ?? [])];
    const effectiveIntent = weatherIntent(intent);
    const userId = await getCurrentUserId();
    const curate = await shouldCurateToday(premium, userId);
    const body: Record<string, unknown> = {
      ...(effectiveIntent ? { intent: effectiveIntent } : {}),
      ...(allExclude.length ? { exclude_ids: allExclude } : {}),
      ...(sessionFormulaId ? { formula_id: sessionFormulaId } : {}),
      ...(useAppStore.getState().genderAwareStyling ? { gender_aware: true } : {}),
      ...(useAppStore.getState().bodyNeutralMode ? { body_neutral: true } : {}),
      locale: i18n.language?.startsWith('vi') ? 'vi' : 'en',
      curate,
    };

    const { data, error } = await sb.functions.invoke('generate-outfits', { body });
    if (error) {
      console.warn('[fitEngineStore] fetchOutfits failed:', error);
      set({ feedError: true });
      return [];
    }

    const response = data as GenerateOutfitsResponse;
    const newOutfits = response.outfits ?? [];
    const newIds = newOutfits.map(outfitKey);
    set({ styleFallback: response.style_fallback?.styles ?? null, lastCurated: response.curated ?? false });

    // Only burn the free user's daily curate slot once the server confirms it
    // actually curated this batch (it can silently degrade to rule order under
    // rate-limit) — and only after the fetch itself succeeded, above.
    if (!premium && response.curated) markCurateUsedToday(userId).catch(() => {});

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
      ...(useAppStore.getState().genderAwareStyling ? { gender_aware: true } : {}),
      ...(useAppStore.getState().bodyNeutralMode ? { body_neutral: true } : {}),
      locale: i18n.language?.startsWith('vi') ? 'vi' : 'en',
      curate: false, // deterministic pairing; no LLM curation / no credit
    };

    const { data, error } = await sb.functions.invoke('generate-outfits', { body });
    if (error) {
      console.warn('[fitEngineStore] fetchMixMatchOutfits failed:', error);
      throw error instanceof Error ? error : new Error(i18n.t('tryOnStore_mixMatchFailed'));
    }
    const response = data as { outfits?: ScoredOutfit[] };
    return response.outfits ?? [];
  },

  fetchMoreOutfits: async () => {
    if (get().isFetchingMore) return;
    set({ isFetchingMore: true });
    const { shownOutfitIds, dismissedOutfitIds, sessionFormulaId, premium } = get();
    try {
      const effectiveIntent = weatherIntent();
      const userId = await getCurrentUserId();
      const curate = await shouldCurateToday(premium, userId);
      const body: Record<string, unknown> = {
        exclude_ids: [...shownOutfitIds, ...dismissedOutfitIds],
        ...(effectiveIntent ? { intent: effectiveIntent } : {}),
        ...(sessionFormulaId ? { formula_id: sessionFormulaId } : {}),
        ...(useAppStore.getState().genderAwareStyling ? { gender_aware: true } : {}),
        ...(useAppStore.getState().bodyNeutralMode ? { body_neutral: true } : {}),
        locale: i18n.language?.startsWith('vi') ? 'vi' : 'en',
        curate,
      };
      const { data, error } = await sb.functions.invoke('generate-outfits', { body });
      if (error) {
        console.warn('[fitEngineStore] fetchMoreOutfits failed:', error);
        set({ feedError: true });
        return;
      }
      const response = data as GenerateOutfitsResponse;
      const newOutfits = response.outfits ?? [];
      const newIds = newOutfits.map(outfitKey);
      set({ styleFallback: response.style_fallback?.styles ?? null, lastCurated: response.curated ?? false });

      if (!premium && response.curated) markCurateUsedToday(userId).catch(() => {});

      logImpressions(newOutfits.map((o, i) => ({
        outfitId: outfitKey(o), curated: response.curated ?? false, formula: o.formula, position: i,
      }))).catch(() => {});

      if (newOutfits.length < 3) {
        // Near the end of the exclude-able catalog — flush shown IDs for a
        // fresh cycle (mirrors fetchOutfits). The next page can now legally
        // re-return an outfit already on screen (exclude list just reset), so
        // merge into the existing list BY ID instead of blind-appending —
        // appending would duplicate that outfit's React key in the pager.
        set(s => {
          const byId = new Map(s.outfits.map(o => [outfitKey(o), o] as const));
          for (const o of newOutfits) byId.set(outfitKey(o), o);
          return { outfits: [...byId.values()], shownOutfitIds: [] };
        });
        AsyncStorage.removeItem(SHOWN_IDS_KEY).catch(() => {});
      } else {
        set(s => ({
          outfits: [...s.outfits, ...newOutfits],
          shownOutfitIds: [...s.shownOutfitIds, ...newIds],
        }));
      }
    } catch (err) {
      console.warn('[fitEngineStore] fetchMoreOutfits failed:', err);
      set({ feedError: true });
    } finally {
      set({ isFetchingMore: false });
    }
  },

  reset: () => {
    set({
      bodyMeasurements: { ...EMPTY_BODY },
      styleProfile: { selectedStyles: [] },
      colorPreferences: [],
      formulaPreferences: [],
      suggestByStyle: true,
      suggestByPersonalColor: true,
      suggestByFormula: true,
      suggestByMeasurements: true,
      shapeGoal: 'auto',
      pendingEstimate: null,
      // Cross-account leak: these were previously left untouched on sign-out,
      // so the next user to sign in on the same device briefly saw the prior
      // user's feed/report state (outfits already fetched, premium flag,
      // session formula selection).
      outfits: [],
      shownOutfitIds: [],
      dismissedOutfitIds: [],
      sessionFormulaId: null,
      premium: false,
      styleFallback: null,
      lastCurated: false,
    });
    AsyncStorage.removeItem(SHOWN_IDS_KEY).catch(() => {});
    AsyncStorage.removeItem(DISMISSED_IDS_KEY).catch(() => {});
  },

  hydrate: async () => {
    // Re-hydrate whenever auth becomes available. hydrate() runs once at app
    // start (from _layout) and can fire before the persisted session is
    // restored (cold-start race) — the initial fetch then returns nothing.
    // This also covers the first OTP login, where hydrate already ran with no
    // session. Without it, styleProfile / colorPreferences stay empty for the
    // whole session, so the Style/Colour preference screens show no selections
    // even though they exist on the server. Deduped by user id so routine token
    // refreshes don't refetch. On sign-out, wipe the private style/body state.
    if (!_fitAuthListenerRegistered) {
      _fitAuthListenerRegistered = true;
      let lastAuthedUid: string | null = null;
      sb.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id ?? null;
        if (uid) {
          if (uid !== lastAuthedUid) {
            lastAuthedUid = uid;
            get().hydrate();
          }
        } else {
          lastAuthedUid = null;
          get().reset();
        }
      });
    }

    try {
      // Restore shown IDs from storage
      const raw = await AsyncStorage.getItem(SHOWN_IDS_KEY);
      if (raw) set({ shownOutfitIds: JSON.parse(raw) });

      // Restore dismissed IDs from storage (feed-signals, 2026-08-07)
      const dismissedRaw = await AsyncStorage.getItem(DISMISSED_IDS_KEY);
      if (dismissedRaw) set({ dismissedOutfitIds: JSON.parse(dismissedRaw) });

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
          suggestByStyle:          styleData?.suggestByStyle ?? true,
          suggestByPersonalColor:  styleData?.suggestByPersonalColor ?? true,
          suggestByFormula:        styleData?.suggestByFormula ?? true,
          suggestByMeasurements:   styleData?.suggestByMeasurements ?? true,
          shapeGoal:               styleData?.shapeGoal ?? 'auto',
        });
      }
    } catch (err) {
      console.warn('[fitEngineStore] hydrate failed:', err);
    } finally {
      set({ hydrated: true });
    }
  },
}));
