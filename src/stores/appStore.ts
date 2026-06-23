import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
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

export interface WornEntry {
  outfitId: string;
  date: string; // ISO date string YYYY-MM-DD
}

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

  // ── Collections (server-persisted, locally cached) ─────────────────────────
  collections: Collection[];
  collectionsError: string | null;            // session-only
  createCollection: (name: string, description: string) => Promise<void>;
  updateCollection: (id: string, patch: { name?: string; description?: string }) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addItemToCollection: (collectionId: string, itemId: string) => Promise<void>;
  removeItemFromCollection: (collectionId: string, itemId: string) => Promise<void>;

  // ── Preferences (persisted) ────────────────────────────────────────────────
  unitPreference: 'metric' | 'imperial';

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
}

// ─── Persisted shape ─────────────────────────────────────────────────────────

interface Persisted {
  savedSet: string[];
  scheduledSet: string[];
  wornSet: string[];
  collectionsAddedSet: string[];
  scheduleMap: Record<string, string>;
  wornHistory: WornEntry[];
  userItems: ClothingItem[];
  collections: Collection[];
  unitPreference?: 'metric' | 'imperial';
  weatherContext?: WeatherContext | null;
  weatherLastFetched?: string | null;
  language?: 'en' | 'vi';
}

function save(s: {
  items: ClothingItem[];
  savedSet: Set<string>;
  scheduledSet: Set<string>;
  wornSet: Set<string>;
  collectionsAddedSet: Set<string>;
  scheduleMap: Record<string, string>;
  wornHistory: WornEntry[];
  collections: Collection[];
  unitPreference: 'metric' | 'imperial';
  weatherContext: WeatherContext | null;
  weatherLastFetched: string | null;
  language: 'en' | 'vi';
}) {
  const data: Persisted = {
    savedSet: [...s.savedSet],
    scheduledSet: [...s.scheduledSet],
    wornSet: [...s.wornSet],
    collectionsAddedSet: [...s.collectionsAddedSet],
    scheduleMap: s.scheduleMap,
    wornHistory: s.wornHistory ?? [],
    userItems: s.items.filter(i => !BASE_IDS.has(i.id)),
    collections: s.collections,
    unitPreference: s.unitPreference,
    weatherContext: s.weatherContext,
    weatherLastFetched: s.weatherLastFetched,
    language: s.language,
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
        set({ wardrobeError: 'Photo upload failed. Please try again.' });
      } else if (err instanceof WardrobeDbError) {
        set({ wardrobeError: 'Failed to save item. Please try again.' });
      } else {
        set({ wardrobeError: 'Something went wrong. Please try again.' });
      }
    }
  },

  removeWardrobeItem: async (id) => {
    set({ wardrobeError: null });
    try {
      await deleteItem(id);
      set(s => ({ wardrobeItems: s.wardrobeItems.filter(i => i.id !== id) }));
    } catch (err) {
      if (err instanceof WardrobeDbError) {
        set({ wardrobeError: 'Failed to delete item. Please try again.' });
      } else {
        set({ wardrobeError: 'Something went wrong. Please try again.' });
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
        set({ wardrobeError: 'Failed to update item. Please try again.' });
      } else {
        set({ wardrobeError: 'Something went wrong. Please try again.' });
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
      // Best-effort server sync
      if (wasSaved) unsaveOutfit(id).catch(() => {});
      else saveOutfit(id).catch(() => {});
      return { savedSet };
    });
  },

  toggleSchedule: (id) => {
    set((s) => {
      const scheduledSet = new Set(s.scheduledSet);
      const wasScheduled = scheduledSet.has(id);
      wasScheduled ? scheduledSet.delete(id) : scheduledSet.add(id);
      save({ ...s, scheduledSet });
      if (wasScheduled) unscheduleOutfit(id).catch(() => {});
      else scheduleOutfit(id, new Date().toISOString().split('T')[0]).catch(() => {});
      return { scheduledSet };
    });
  },

  toggleWorn: (id) => {
    set((s) => {
      const wornSet = new Set(s.wornSet);
      const wasWorn = wornSet.has(id);
      wasWorn ? wornSet.delete(id) : wornSet.add(id);
      save({ ...s, wornSet });
      if (wasWorn) unmarkWorn(id).catch(() => {});
      else svcMarkWorn(id).catch(() => {});
      return { wornSet };
    });
  },

  wornHistory: [],
  markWorn: (outfitId) => set((s) => {
    const entry: WornEntry = { outfitId, date: new Date().toISOString().split('T')[0] };
    const wornHistory = [entry, ...s.wornHistory];
    const wornSet = new Set(s.wornSet);
    wornSet.add(outfitId);
    svcMarkWorn(outfitId).catch(() => {});
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
    } catch {
      set({ collectionsError: 'Failed to create collection. Please try again.' });
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
    } catch {
      set({ collectionsError: 'Failed to save collection. Please try again.' });
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
    } catch {
      set({ collectionsError: 'Failed to delete collection. Please try again.' });
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
    } catch {
      set({ collectionsError: 'Failed to add item. Please try again.' });
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
    } catch {
      set({ collectionsError: 'Failed to remove item. Please try again.' });
    }
  },

  // ── Preferences ────────────────────────────────────────────────────────────
  unitPreference: 'metric',

  // ── Language ───────────────────────────────────────────────────────────────
  language: 'en' as const,

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
    try {
      const [interactions, cooldownIds] = await Promise.all([
        fetchInteractions(),
        fetchWornCooldownIds(),
      ]);
      const savedSet = new Set<string>();
      const wornSet  = new Set<string>();
      const scheduledSet = new Set<string>();
      for (const i of interactions) {
        if (i.type === 'saved')     savedSet.add(i.outfitId);
        if (i.type === 'worn')      wornSet.add(i.outfitId);
        if (i.type === 'scheduled') scheduledSet.add(i.outfitId);
      }
      set({ savedSet, wornSet, scheduledSet, wornCooldownIds: cooldownIds });
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

  // ── Hydration ─────────────────────────────────────────────────────────────
  hydrate: async () => {
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
        set({ wardrobeItems: [] });
      }
    });

    try {
      // 1. Restore persisted local state
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let legacyUserItems: ClothingItem[] = [];

      if (raw) {
        const data: Persisted = JSON.parse(raw);
        legacyUserItems = data.userItems ?? [];
        set({
          savedSet:            new Set(data.savedSet ?? ['o2']),
          scheduledSet:        new Set(data.scheduledSet ?? []),
          wornSet:             new Set(data.wornSet ?? []),
          collectionsAddedSet: new Set(data.collectionsAddedSet ?? []),
          scheduleMap:         data.scheduleMap ?? {},
          wornHistory:         data.wornHistory ?? [],
          items:               [...ITEMS, ...legacyUserItems],
          collections:         data.collections ?? COLLECTIONS,
          unitPreference:      data.unitPreference ?? 'metric',
          weatherContext:      data.weatherContext ?? null,
          weatherLastFetched:  data.weatherLastFetched ?? null,
          language:            data.language ?? 'en',
        });
        if (data.language) i18n.changeLanguage(data.language);
      }

      // 2. Reconcile server-backed state (wardrobe + interactions + collections).
      //    May be a no-op if the session isn't restored yet — the auth-state
      //    listener (set up above) re-runs this the moment a user is available.
      await get().loadServerState();

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
  },
}));
