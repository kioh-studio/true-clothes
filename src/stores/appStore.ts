import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { ClothingItem, Collection, ITEMS, COLLECTIONS } from '../data';
import { WardrobeItem } from '../types/fitEngine';
import { WeatherContext } from '../types/weather';
import {
  fetchMyItems, addItem, deleteItem,
  migrateLocalItems,
  AddItemInput, LegacyLocalItem,
  WardrobeStorageError, WardrobeDbError,
} from '../services/wardrobeService';
import { fetchCurrentWeather } from '../services/weatherService';
import { useAuthStore } from './authStore';

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
  wardrobeError: string | null;            // session-only

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

  collections: Collection[];

  // ── Preferences (persisted) ────────────────────────────────────────────────
  unitPreference: 'metric' | 'imperial';

  // ── Weather (persisted context, session error) ─────────────────────────────
  weatherContext: WeatherContext | null;
  weatherLastFetched: string | null;
  refreshWeather: () => Promise<void>;

  hydrate: () => Promise<void>;
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

  addWardrobeItem: async (input) => {
    // T015: offline guard
    const netState = await NetInfo.fetch();
    if (netState.isConnected === false) {
      set({ wardrobeError: 'Adding items requires an internet connection' });
      return;
    }

    set({ wardrobeError: null });
    try {
      const item = await addItem(input);
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

  // ── Outfit interaction ─────────────────────────────────────────────────────
  savedSet: new Set(['o2']),
  scheduledSet: new Set(),
  wornSet: new Set(),
  collectionsAddedSet: new Set(),

  toggleSave: (id) => set((s) => {
    const savedSet = new Set(s.savedSet);
    savedSet.has(id) ? savedSet.delete(id) : savedSet.add(id);
    save({ ...s, savedSet });
    return { savedSet };
  }),

  toggleSchedule: (id) => set((s) => {
    const scheduledSet = new Set(s.scheduledSet);
    scheduledSet.has(id) ? scheduledSet.delete(id) : scheduledSet.add(id);
    save({ ...s, scheduledSet });
    return { scheduledSet };
  }),

  toggleWorn: (id) => set((s) => {
    const wornSet = new Set(s.wornSet);
    wornSet.has(id) ? wornSet.delete(id) : wornSet.add(id);
    save({ ...s, wornSet });
    return { wornSet };
  }),

  wornHistory: [],
  markWorn: (outfitId) => set((s) => {
    const entry: WornEntry = { outfitId, date: new Date().toISOString().split('T')[0] };
    const wornHistory = [entry, ...s.wornHistory];
    const wornSet = new Set(s.wornSet);
    wornSet.add(outfitId);
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

  collections: COLLECTIONS,

  // ── Preferences ────────────────────────────────────────────────────────────
  unitPreference: 'metric',

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

  // ── Hydration ─────────────────────────────────────────────────────────────
  hydrate: async () => {
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
        });
      }

      // 2. Fetch remote wardrobe (requires auth)
      try {
        const remoteItems = await fetchMyItems();
        set({ wardrobeItems: remoteItems });
      } catch {
        // Not authenticated or network failure — continue with empty wardrobe
      }

      // 3. T016: First-boot migration from AsyncStorage to Supabase
      const migrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      if (!migrated && legacyUserItems.length > 0) {
        const total = legacyUserItems.length;
        set({ migrationProgress: { done: 0, total } });

        const migratedItems = await migrateLocalItems(
          legacyUserItems as unknown as LegacyLocalItem[],
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
    }
  },
}));
