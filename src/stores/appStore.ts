import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Localization from 'expo-localization';
import { ClothingItem, Collection, ITEMS, COLLECTIONS } from '../data';
import { WardrobeItem } from '../types/fitEngine';
import { WeatherContext } from '../types/weather';
import {
  fetchMyItems, addItem, deleteItem, updateItem,
  migrateLocalItems, listPendingCloudUploads, promoteToCloud,
  AddItemInput, UpdateItemInput, LegacyLocalItem,
  WardrobeStorageError, WardrobeDbError,
} from '../services/wardrobeService';
import { useFitEngineStore } from './fitEngineStore';
import { sb } from '../services/supabase';
import { genId } from '../utils/genId';
import { withTimeout, HYDRATE_TIMEOUT_MS } from '../utils/withTimeout';
import {
  saveOutfit, unsaveOutfit,
  markWorn as svcMarkWorn, unmarkWorn,
  scheduleOutfit, unscheduleOutfit,
  fetchInteractions, fetchWornCooldownIds,
} from '../services/outfitInteractionService';
import { fetchCurrentWeather } from '../services/weatherService';
import {
  fetchMyCollections,
  createCollection as svcCreateCollection,
  updateCollection as svcUpdateCollection,
  deleteCollection as svcDeleteCollection,
  addItemToCollection as svcAddItemToCollection,
  removeItemFromCollection as svcRemoveItemFromCollection,
  createdLabel,
} from '../services/collectionsService';
import { useAuthStore } from './authStore';
import i18n from '../i18n';

const STORAGE_KEY = 'app-store';
const MIGRATION_FLAG_KEY = 'wardrobe-migrated-v1';
const BASE_IDS = new Set(ITEMS.map(i => i.id));

// ─── Schedule snapshot ────────────────────────────────────────────────────────
// A lightweight, durable snapshot of a planned outfit captured at schedule time.
// Persisted alongside the schedule so planned days survive feed regeneration,
// which changes the volatile gen_* ids every session.
export interface OutfitSnapshot {
  id: string;
  title: string;
  imageUri?: string;
  styleTag?: string;
}

// ─── Module-level listener guard (Bug 1) ─────────────────────────────────────
// hydrate() can be called more than once (Fast Refresh, remount). Without this
// guard each call stacks another NetInfo + onAuthStateChange listener, causing
// duplicated loadServerState fetches per auth event and a memory leak. The flag
// ensures both listeners are registered exactly once per app process.
let _listenersRegistered = false;

// ─── In-flight interaction write counter (Bug 2) ──────────────────────────────
// toggleSave / toggleSchedule / toggleWorn / markWorn do an optimistic local
// update and then fire a best-effort async write to the server. If an auth event
// triggers loadServerState while one of those writes is in flight, the server
// read can overwrite the optimistic set before the write lands. We track the
// number of writes in progress and skip the interactions overwrite in
// loadServerState when the counter is > 0.
let _interactionWritesInFlight = 0;

// ─── In-flight hydrate guard ──────────────────────────────────────────────────
// hydrate() can be invoked twice nearly simultaneously (Fast Refresh, remount,
// or a direct call racing the INITIAL_SESSION listener set up inside it). A
// second call while one is already running reuses that promise instead of
// starting an independent, overlapping run.
let _hydrateInFlight: Promise<void> | null = null;

// ─── In-flight addWardrobeItem guard ──────────────────────────────────────────
// A double-tap on "Add" (or any duplicate call while a save is still pending)
// must not fire two independent inserts. A call while one is in flight reuses
// the same promise instead of racing a second addItem() against it.
let _addWardrobeItemInFlight: Promise<void> | null = null;

// Local-date (device timezone) YYYY-MM-DD — NOT toISOString(), which is UTC
// and misreports "today" during the UTC+7 morning window (00:00–07:00 local
// falls on the previous UTC calendar day).
// First-run language default: derive from device locale so a fresh install on
// a Vietnamese device starts in vi instead of always defaulting to en. Once a
// language is persisted (user choice, or a prior device-derived default that
// got saved), that persisted value always wins — this is only consulted when
// there is nothing persisted yet.
function deviceDefaultLanguage(): 'en' | 'vi' {
  const code = Localization.getLocales()[0]?.languageCode;
  return code?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface WornEntry {
  outfitId: string;
  date: string; // ISO date string YYYY-MM-DD
}

export interface NotificationPrefs {
  dailyOutfit: boolean;
  weather: boolean;
  wardrobe: boolean;
  marketing: boolean;
}
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyOutfit: true, weather: true, wardrobe: true, marketing: false,
};

interface AppState {
  hydrated: boolean;

  // ── Demo/local items (outfit collage, base seeded data) ────────────────────
  items: ClothingItem[];
  addItem: (item: ClothingItem) => void;
  removeItem: (id: string) => void;

  // ── Remote wardrobe items (Supabase-backed) ────────────────────────────────
  wardrobeItems: WardrobeItem[];
  addWardrobeItem: (input: AddItemInput) => Promise<void>;
  removeWardrobeItem: (id: string) => Promise<void>;
  updateWardrobeItem: (id: string, patch: UpdateItemInput) => Promise<void>;
  wardrobeError: string | null;            // session-only

  // Push any still-local photos to the cloud for premium users. Doubles as the
  // upload-retry queue (offline adds) and the free→premium upgrade migration
  // (feature 003-upload-image, research D7/D8).
  syncPendingPhotos: () => Promise<void>;

  // ── Offline state ──────────────────────────────────────────────────────────
  isOffline: boolean;

  // ── Worn cooldown (server-backed) ─────────────────────────────────────────
  wornCooldownIds: string[];

  // ── Migration progress (session-only) ──────────────────────────────────────
  migrationProgress: { done: number; total: number } | null;

  // ── Outfit interaction sets ────────────────────────────────────────────────
  savedSet: Set<string>;
  scheduledSet: Set<string>;
  wornSet: Set<string>;
  collectionsAddedSet: Set<string>;
  toggleSave: (id: string) => void;
  toggleSchedule: (id: string) => void;
  toggleWorn: (id: string) => void;
  toggleCollection: (id: string) => void;

  wornHistory: WornEntry[];
  markWorn: (outfitId: string) => void;

  scheduleMap: Record<string, string>;
  setScheduleOutfit: (dateKey: string, outfitId: string) => void;
  clearScheduleOutfit: (dateKey: string) => void;

  // Durable snapshot store — survives feed regeneration between sessions.
  scheduledOutfits: Record<string, OutfitSnapshot>;
  setScheduledOutfit: (dateKey: string, snapshot: OutfitSnapshot) => void;
  clearScheduledOutfit: (dateKey: string) => void;

  // ── Collections (server-persisted, locally cached) ─────────────────────────
  collections: Collection[];
  collectionsError: string | null;            // session-only
  // Return the created Collection on success, or null on failure — callers
  // MUST check this instead of blindly reading collections[0] (which is stale
  // — the OLD first collection — when creation fails).
  createCollection: (name: string, description: string) => Promise<Collection | null>;
  // Return true on success, false on failure — callers use this to decide
  // whether to close a sheet / show a success state.
  updateCollection: (id: string, patch: { name?: string; description?: string }) => Promise<boolean>;
  deleteCollection: (id: string) => Promise<boolean>;
  addItemToCollection: (collectionId: string, itemId: string) => Promise<boolean>;
  removeItemFromCollection: (collectionId: string, itemId: string) => Promise<boolean>;

  // ── Preferences (persisted) ────────────────────────────────────────────────
  unitPreference: 'metric' | 'imperial';
  setUnitPreference: (next: 'metric' | 'imperial') => void;

  // Opt-in: let the outfit engine softly bias fit/silhouette by the gender on the
  // user's profile. Off by default; only WOMAN/MAN are nudged server-side. Sent to
  // generate-outfits as `gender_aware`. See docs/fit-engine.md.
  genderAwareStyling: boolean;
  setGenderAwareStyling: (v: boolean) => void;

  // Opt-in: strip ALL body-shape influence from outfit scoring, purchase
  // evaluation, and the shown rationale — for users who don't want shape-based
  // suggestions. Off by default. Sent to generate-outfits, evaluate-item, and
  // wardrobe-critic as `body_neutral`; each edge function nulls out `body_shape`
  // before it reaches the shared engine, reusing its existing `!body.body_shape`
  // guards. See docs/research/body-shape-importance-FINAL.md (recommendation #6).
  bodyNeutralMode: boolean;
  setBodyNeutralMode: (v: boolean) => void;

  notificationPrefs: NotificationPrefs;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;

  // ── Weather (persisted context, session error) ─────────────────────────────
  weatherContext: WeatherContext | null;
  weatherLastFetched: string | null;
  refreshWeather: () => Promise<void>;

  // ── Language (persisted) ─────────────────────────────────────────────────
  language: 'en' | 'vi';
  setLanguage: (lang: 'en' | 'vi') => void;

  hydrate: () => Promise<void>;
  /**
   * Reconcile server-backed state (wardrobe, outfit interactions, collections)
   * for the currently authenticated user. Safe to call repeatedly; each block is
   * independently guarded. Invoked from hydrate AND from the auth-state listener
   * so data loads once the session is actually available (fixes the cold-start
   * race where hydrate ran before the session was restored, and the first OTP
   * login where hydrate had already run with no session).
   */
  loadServerState: () => Promise<void>;
  /**
   * Clear user-personal and server-sourced state on sign-out so a new user
   * never sees the previous user's private data. Preferences (unit, language)
   * and local items are intentionally kept.
   */
  resetUserState: () => void;
}

// ─── Persisted shape ─────────────────────────────────────────────────────────

interface Persisted {
  savedSet: string[];
  scheduledSet: string[];
  wornSet: string[];
  collectionsAddedSet: string[];
  scheduleMap: Record<string, string>;
  scheduledOutfits?: Record<string, OutfitSnapshot>;
  wornHistory: WornEntry[];
  userItems: ClothingItem[];
  collections: Collection[];
  unitPreference?: 'metric' | 'imperial';
  genderAwareStyling?: boolean;
  bodyNeutralMode?: boolean;
  weatherContext?: WeatherContext | null;
  weatherLastFetched?: string | null;
  language?: 'en' | 'vi';
  notificationPrefs?: NotificationPrefs;
}

function save(s: {
  items: ClothingItem[];
  savedSet: Set<string>;
  scheduledSet: Set<string>;
  wornSet: Set<string>;
  collectionsAddedSet: Set<string>;
  scheduleMap: Record<string, string>;
  scheduledOutfits: Record<string, OutfitSnapshot>;
  wornHistory: WornEntry[];
  collections: Collection[];
  unitPreference: 'metric' | 'imperial';
  genderAwareStyling: boolean;
  bodyNeutralMode: boolean;
  weatherContext: WeatherContext | null;
  weatherLastFetched: string | null;
  language: 'en' | 'vi';
  notificationPrefs: NotificationPrefs;
}) {
  const data: Persisted = {
    savedSet: [...s.savedSet],
    scheduledSet: [...s.scheduledSet],
    wornSet: [...s.wornSet],
    collectionsAddedSet: [...s.collectionsAddedSet],
    scheduleMap: s.scheduleMap,
    scheduledOutfits: s.scheduledOutfits,
    wornHistory: s.wornHistory ?? [],
    userItems: s.items.filter(i => !BASE_IDS.has(i.id)),
    collections: s.collections,
    unitPreference: s.unitPreference,
    genderAwareStyling: s.genderAwareStyling,
    bodyNeutralMode: s.bodyNeutralMode,
    weatherContext: s.weatherContext,
    weatherLastFetched: s.weatherLastFetched,
    language: s.language,
    notificationPrefs: s.notificationPrefs,
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,

  // ── Demo items ────────────────────────────────────────────────────────────
  items: ITEMS,

  addItem: (item) => set((s) => {
    const items = [item, ...s.items];
    save({ ...s, items });
    return { items };
  }),

  removeItem: (id) => set((s) => {
    const items = s.items.filter(i => i.id !== id);
    save({ ...s, items });
    return { items };
  }),

  // ── Remote wardrobe ────────────────────────────────────────────────────────
  wardrobeItems: [],
  wardrobeError: null,
  migrationProgress: null,
  isOffline: false,
  wornCooldownIds: [],

  addWardrobeItem: async (input) => {
    // In-flight guard: a double-tap (or any duplicate call) while a save is
    // still pending reuses the same promise instead of firing a second insert.
    if (_addWardrobeItemInFlight) return _addWardrobeItemInFlight;

    const run = async () => {
      // Feature 003: adding works offline. Free items are stored on-device; premium
      // items are stored on-device first and uploaded to the cloud when possible
      // (a failed/absent upload leaves the item 'local' for syncPendingPhotos to retry).
      set({ wardrobeError: null });
      try {
        const tier = useFitEngineStore.getState().premium ? 'premium' : 'free';
        const item = await addItem(input, tier);
        set(s => ({ wardrobeItems: [item, ...s.wardrobeItems] }));
      } catch (err) {
        if (err instanceof WardrobeStorageError) {
          set({ wardrobeError: i18n.t('wardrobeStore_photoUploadFailed') });
        } else if (err instanceof WardrobeDbError) {
          set({ wardrobeError: i18n.t('wardrobeStore_saveItemFailed') });
        } else {
          set({ wardrobeError: i18n.t('paywall_genericErrorMessage') });
        }
      }
    };

    _addWardrobeItemInFlight = run().finally(() => { _addWardrobeItemInFlight = null; });
    return _addWardrobeItemInFlight;
  },

  removeWardrobeItem: async (id) => {
    set({ wardrobeError: null });
    try {
      await deleteItem(id);
      set(s => ({ wardrobeItems: s.wardrobeItems.filter(i => i.id !== id) }));
    } catch (err) {
      if (err instanceof WardrobeDbError) {
        set({ wardrobeError: i18n.t('wardrobeStore_deleteItemFailed') });
      } else {
        set({ wardrobeError: i18n.t('paywall_genericErrorMessage') });
      }
    }
  },

  updateWardrobeItem: async (id, patch) => {
    set({ wardrobeError: null });
    try {
      const updated = await updateItem(id, patch);
      set(s => ({ wardrobeItems: s.wardrobeItems.map(i => i.id === id ? updated : i) }));
    } catch (err) {
      if (err instanceof WardrobeDbError) {
        set({ wardrobeError: i18n.t('wardrobeStore_updateItemFailed') });
      } else {
        set({ wardrobeError: i18n.t('paywall_genericErrorMessage') });
      }
    }
  },

  syncPendingPhotos: async () => {
    if (!useFitEngineStore.getState().premium) return;
    try {
      const pending = await listPendingCloudUploads();
      for (const it of pending) {
        const updated = await promoteToCloud(it.id);
        if (updated) {
          set(s => ({ wardrobeItems: s.wardrobeItems.map(w => (w.id === updated.id ? updated : w)) }));
        }
      }
    } catch (err) {
      console.warn('[appStore] syncPendingPhotos failed:', err);
    }
  },

  // ── Outfit interaction ─────────────────────────────────────────────────────
  savedSet: new Set(['o2']),
  scheduledSet: new Set(),
  wornSet: new Set(),
  collectionsAddedSet: new Set(),

  toggleSave: (id) => {
    set((s) => {
      const savedSet = new Set(s.savedSet);
      const wasSaved = savedSet.has(id);
      wasSaved ? savedSet.delete(id) : savedSet.add(id);
      save({ ...s, savedSet });
      // Best-effort server sync — guarded by in-flight counter so loadServerState
      // never clobbers the optimistic update while the write is pending.
      _interactionWritesInFlight++;
      const writeP = wasSaved ? unsaveOutfit(id) : saveOutfit(id);
      writeP.catch(() => {}).finally(() => { _interactionWritesInFlight--; });
      return { savedSet };
    });
  },

  toggleSchedule: (id) => {
    set((s) => {
      const scheduledSet = new Set(s.scheduledSet);
      const wasScheduled = scheduledSet.has(id);
      wasScheduled ? scheduledSet.delete(id) : scheduledSet.add(id);
      save({ ...s, scheduledSet });
      _interactionWritesInFlight++;
      const writeP = wasScheduled
        ? unscheduleOutfit(id)
        : scheduleOutfit(id, localDateKey());
      writeP.catch(() => {}).finally(() => { _interactionWritesInFlight--; });
      return { scheduledSet };
    });
  },

  toggleWorn: (id) => {
    set((s) => {
      const wornSet = new Set(s.wornSet);
      const wasWorn = wornSet.has(id);
      wasWorn ? wornSet.delete(id) : wornSet.add(id);
      save({ ...s, wornSet });
      _interactionWritesInFlight++;
      const writeP = wasWorn ? unmarkWorn(id) : svcMarkWorn(id);
      writeP.catch(() => {}).finally(() => { _interactionWritesInFlight--; });
      return { wornSet };
    });
  },

  wornHistory: [],
  markWorn: (outfitId) => set((s) => {
    const entry: WornEntry = { outfitId, date: localDateKey() };
    const wornHistory = [entry, ...s.wornHistory];
    const wornSet = new Set(s.wornSet);
    wornSet.add(outfitId);
    _interactionWritesInFlight++;
    svcMarkWorn(outfitId).catch(() => {}).finally(() => { _interactionWritesInFlight--; });
    save({ ...s, wornHistory, wornSet });
    return { wornHistory, wornSet };
  }),

  toggleCollection: (id) => set((s) => {
    const collectionsAddedSet = new Set(s.collectionsAddedSet);
    collectionsAddedSet.has(id) ? collectionsAddedSet.delete(id) : collectionsAddedSet.add(id);
    save({ ...s, collectionsAddedSet });
    return { collectionsAddedSet };
  }),

  scheduleMap: {},

  setScheduleOutfit: (dateKey, outfitId) => set((s) => {
    const scheduleMap = { ...s.scheduleMap, [dateKey]: outfitId };
    save({ ...s, scheduleMap });
    return { scheduleMap };
  }),

  clearScheduleOutfit: (dateKey) => set((s) => {
    const scheduleMap = { ...s.scheduleMap };
    delete scheduleMap[dateKey];
    save({ ...s, scheduleMap });
    return { scheduleMap };
  }),

  // ── Durable schedule snapshots ─────────────────────────────────────────────
  scheduledOutfits: {},

  setScheduledOutfit: (dateKey, snapshot) => set((s) => {
    const scheduledOutfits = { ...s.scheduledOutfits, [dateKey]: snapshot };
    save({ ...s, scheduledOutfits });
    return { scheduledOutfits };
  }),

  clearScheduledOutfit: (dateKey) => set((s) => {
    const scheduledOutfits = { ...s.scheduledOutfits };
    delete scheduledOutfits[dateKey];
    save({ ...s, scheduledOutfits });
    return { scheduledOutfits };
  }),

  // ── Collections ────────────────────────────────────────────────────────────
  // Server-persisted (Supabase) with a local cache for read-only offline. Mutations
  // update local state optimistically and best-effort sync to the server; the next
  // hydrate reconciles from the server when authenticated.
  collections: COLLECTIONS,
  collectionsError: null,

  createCollection: async (name, description) => {
    set({ collectionsError: null });
    try {
      const created = await svcCreateCollection(name, description);
      const col: Collection = created ?? {
        id: genId(),
        name,
        description,
        createdDate: createdLabel(new Date().toISOString()),
        itemIds: [],
      };
      set((s) => {
        const collections = [col, ...s.collections];
        save({ ...s, collections });
        return { collections };
      });
      return col;
    } catch {
      set({ collectionsError: i18n.t('collectionsStore_createFailed') });
      return null;
    }
  },

  updateCollection: async (id, patch) => {
    set((s) => {
      const collections = s.collections.map(c => c.id === id ? { ...c, ...patch } : c);
      save({ ...s, collections });
      return { collections };
    });
    try {
      await svcUpdateCollection(id, patch);
      return true;
    } catch {
      set({ collectionsError: i18n.t('collectionsStore_saveFailed') });
      return false;
    }
  },

  deleteCollection: async (id) => {
    set((s) => {
      const collections = s.collections.filter(c => c.id !== id);
      save({ ...s, collections });
      return { collections };
    });
    try {
      await svcDeleteCollection(id);
      return true;
    } catch {
      set({ collectionsError: i18n.t('collectionsStore_deleteFailed') });
      return false;
    }
  },

  addItemToCollection: async (collectionId, itemId) => {
    set((s) => {
      const collections = s.collections.map(c =>
        c.id === collectionId && !c.itemIds.includes(itemId)
          ? { ...c, itemIds: [...c.itemIds, itemId] }
          : c,
      );
      save({ ...s, collections });
      return { collections };
    });
    try {
      await svcAddItemToCollection(collectionId, itemId);
      return true;
    } catch {
      set({ collectionsError: i18n.t('collectionsStore_addItemFailed') });
      return false;
    }
  },

  removeItemFromCollection: async (collectionId, itemId) => {
    set((s) => {
      const collections = s.collections.map(c =>
        c.id === collectionId
          ? { ...c, itemIds: c.itemIds.filter(i => i !== itemId) }
          : c,
      );
      save({ ...s, collections });
      return { collections };
    });
    try {
      await svcRemoveItemFromCollection(collectionId, itemId);
      return true;
    } catch {
      set({ collectionsError: i18n.t('collectionsStore_removeItemFailed') });
      return false;
    }
  },

  // ── Preferences ────────────────────────────────────────────────────────────
  unitPreference: 'metric',
  setUnitPreference: (next) => set(s => {
    save({ ...s, unitPreference: next });
    return { unitPreference: next };
  }),
  genderAwareStyling: false,
  setGenderAwareStyling: (v) => set(s => {
    save({ ...s, genderAwareStyling: v });
    return { genderAwareStyling: v };
  }),
  bodyNeutralMode: false,
  setBodyNeutralMode: (v) => set(s => {
    save({ ...s, bodyNeutralMode: v });
    return { bodyNeutralMode: v };
  }),

  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  setNotificationPref: (key, value) => set(s => {
    const notificationPrefs = { ...s.notificationPrefs, [key]: value };
    save({ ...s, notificationPrefs });
    return { notificationPrefs };
  }),

  // ── Language ───────────────────────────────────────────────────────────────
  // Provisional value until hydrate() restores/derives the real one — avoids a
  // flash of English on a fresh Vietnamese-device install.
  language: deviceDefaultLanguage(),

  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    set(s => {
      save({ ...s, language: lang });
      return { language: lang };
    });
  },

  // ── Weather ────────────────────────────────────────────────────────────────
  weatherContext: null,
  weatherLastFetched: null,

  refreshWeather: async () => {
    const { weatherContext, weatherLastFetched } = get();
    const TTL_MS = 30 * 60 * 1000;
    const lastFetched = weatherLastFetched ? new Date(weatherLastFetched).getTime() : 0;
    if (Date.now() - lastFetched < TTL_MS && weatherContext) return;

    // Location coords are not currently stored in authStore (location is a string).
    // Skip silently — weather will work once coords are available.
    const authState = useAuthStore.getState() as { profile?: { location?: { coords?: { latitude: number; longitude: number } } } };
    const coords = authState.profile?.location?.coords;
    if (!coords) return;

    try {
      const ctx = await fetchCurrentWeather(coords);
      set(s => ({ weatherContext: ctx, weatherLastFetched: ctx.fetchedAt }));
      const s = get();
      save({ ...s });
    } catch {
      // Retain existing weatherContext on failure — weather is non-blocking
    }
  },

  // Reconcile all server-backed state for the authenticated user. Each block is
  // independently guarded so one failure never blocks the others.
  loadServerState: async () => {
    // Wardrobe
    try {
      const remoteItems = await fetchMyItems();
      set({ wardrobeItems: remoteItems });
    } catch (err) {
      // Not authenticated or network failure — keep current wardrobe
      console.warn('[appStore] loadServerState wardrobe failed:', err);
    }

    // Outfit interactions
    // Skip the set() overwrite if an optimistic write is still in flight —
    // the server read would race against and clobber the user's action.
    // The next loadServerState call (post-write) will reconcile correctly.
    try {
      const [interactions, cooldownIds] = await Promise.all([
        fetchInteractions(),
        fetchWornCooldownIds(),
      ]);
      if (_interactionWritesInFlight > 0) {
        console.warn('[appStore] loadServerState: skipping interactions overwrite — write in flight');
      } else {
        const savedSet = new Set<string>();
        const wornSet  = new Set<string>();
        const scheduledSet = new Set<string>();
        for (const i of interactions) {
          if (i.type === 'saved')     savedSet.add(i.outfitId);
          if (i.type === 'worn')      wornSet.add(i.outfitId);
          if (i.type === 'scheduled') scheduledSet.add(i.outfitId);
        }
        set({ savedSet, wornSet, scheduledSet, wornCooldownIds: cooldownIds });
      }
    } catch {
      // Not authenticated — keep local sets
    }

    // Collections. null = not authenticated → keep cached/demo collections;
    // [] = authenticated with none.
    try {
      const remoteCollections = await fetchMyCollections();
      if (remoteCollections !== null) set({ collections: remoteCollections });
    } catch {
      // Network failure — keep cached collections
    }
  },

  // ── Sign-out cleanup ──────────────────────────────────────────────────────
  // Clear server-sourced and user-personal state on sign-out so a different
  // user signing in never sees the prior session's private data. Preferences
  // (unitPreference, language, genderAwareStyling, bodyNeutralMode) and base
  // items are kept.
  resetUserState: () => set(s => {
    const next = {
      wardrobeItems:      [] as WardrobeItem[],
      savedSet:           new Set<string>(),
      scheduledSet:       new Set<string>(),
      wornSet:            new Set<string>(),
      collectionsAddedSet: new Set<string>(),
      scheduleMap:        {} as Record<string, string>,
      scheduledOutfits:   {} as Record<string, OutfitSnapshot>,
      wornHistory:        [] as WornEntry[],
      wornCooldownIds:    [] as string[],
      collections:        COLLECTIONS,
      weatherContext:     null as WeatherContext | null,
      weatherLastFetched: null as string | null,
    };
    save({ ...s, ...next });
    return next;
  }),

  // ── Hydration ─────────────────────────────────────────────────────────────
  hydrate: () => {
    // In-flight guard: a second concurrent call reuses the same promise
    // instead of racing an independent run against it.
    if (_hydrateInFlight) return _hydrateInFlight;

    const run = async () => {
    // Guard: register NetInfo + onAuthStateChange exactly once per app process.
    // Without this, Fast Refresh / remount / re-hydrate calls stack duplicate
    // listeners that each fire loadServerState on every auth event (Bug 1).
    if (!_listenersRegistered) {
      _listenersRegistered = true;

      // T075: Subscribe to network state changes
      NetInfo.addEventListener(state => {
        const wasOffline = get().isOffline;
        set({ isOffline: state.isConnected === false });
        // On reconnect, flush any photos that couldn't reach the cloud while offline.
        if (wasOffline && state.isConnected) {
          get().syncPendingPhotos().catch(() => {});
        }
      });

      // Re-load server state whenever auth becomes available. hydrate() can run
      // before the persisted session is restored (cold-start race) and the initial
      // fetch would then return empty; this also covers the first OTP login, where
      // hydrate already ran with no session. Deduped by user id so routine token
      // refreshes don't refetch. On sign-out, clear the wardrobe.
      let lastAuthedUid: string | null = null;
      sb.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id ?? null;
        if (uid) {
          if (uid !== lastAuthedUid) {
            lastAuthedUid = uid;
            get().loadServerState();
          }
        } else {
          lastAuthedUid = null;
          get().resetUserState();
        }
      });
    }

    try {
      // 1. Restore persisted local state
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let legacyUserItems: ClothingItem[] = [];

      if (raw) {
        const data: Persisted = JSON.parse(raw);
        legacyUserItems = data.userItems ?? [];
        // Persisted user choice always wins; only a first-run-shaped record
        // (no language field yet) falls back to the device locale.
        const language = data.language ?? deviceDefaultLanguage();
        set({
          savedSet:            new Set(data.savedSet ?? ['o2']),
          scheduledSet:        new Set(data.scheduledSet ?? []),
          wornSet:             new Set(data.wornSet ?? []),
          collectionsAddedSet: new Set(data.collectionsAddedSet ?? []),
          scheduleMap:         data.scheduleMap ?? {},
          scheduledOutfits:    data.scheduledOutfits ?? {},
          wornHistory:         data.wornHistory ?? [],
          items:               [...ITEMS, ...legacyUserItems],
          collections:         data.collections ?? COLLECTIONS,
          unitPreference:      data.unitPreference ?? 'metric',
          genderAwareStyling:  data.genderAwareStyling ?? false,
          bodyNeutralMode:     data.bodyNeutralMode ?? false,
          weatherContext:      data.weatherContext ?? null,
          weatherLastFetched:  data.weatherLastFetched ?? null,
          language,
          notificationPrefs:   data.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS,
        });
        i18n.changeLanguage(language);
      } else {
        // No persisted record at all (brand-new install) — derive from device
        // locale so a Vietnamese-device user starts in vi.
        const language = deviceDefaultLanguage();
        set({ language });
        i18n.changeLanguage(language);
      }

      // 2. Reconcile server-backed state (wardrobe + interactions + collections).
      //    May be a no-op if the session isn't restored yet — the auth-state
      //    listener (set up above) re-runs this the moment a user is available.
      // Bounded: a stalled call must never leave `hydrated` false forever and
      // strand the app behind the splash screen (the auth-state listener will
      // still re-run this once a session becomes available).
      await withTimeout(get().loadServerState(), HYDRATE_TIMEOUT_MS, undefined);

      // 3. T016: First-boot migration from AsyncStorage to Supabase
      const migrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      if (!migrated && legacyUserItems.length > 0) {
        const total = legacyUserItems.length;
        set({ migrationProgress: { done: 0, total } });

        const legacyTier = useFitEngineStore.getState().premium ? 'premium' : 'free';
        const migratedItems = await migrateLocalItems(
          legacyUserItems as unknown as LegacyLocalItem[],
          legacyTier,
          (done, t) => set({ migrationProgress: { done, total: t } }),
        );

        // On completion: flag written, legacy items cleared from persisted state
        await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        set(s => ({
          wardrobeItems: [...migratedItems, ...s.wardrobeItems],
          items: ITEMS, // clear legacy userItems from items array
          migrationProgress: null,
        }));
        // Save with cleared userItems
        const s = get();
        save({ ...s });
      }
    } catch (err) {
      console.warn('[appStore] hydrate failed:', err);
    } finally {
      set({ hydrated: true });
      // Premium: opportunistically push any local-only photos to the cloud.
      get().syncPendingPhotos().catch(() => {});
    }
    };

    _hydrateInFlight = run().finally(() => { _hydrateInFlight = null; });
    return _hydrateInFlight;
  },
}));
