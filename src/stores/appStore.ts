import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClothingItem, Collection, ITEMS, COLLECTIONS } from '../data';

const STORAGE_KEY = 'app-store';
const BASE_IDS = new Set(ITEMS.map(i => i.id));

export interface WornEntry {
  outfitId: string;
  date: string; // ISO date string YYYY-MM-DD
}

interface AppState {
  hydrated: boolean;
  items: ClothingItem[];
  addItem: (item: ClothingItem) => void;
  removeItem: (id: string) => void;

  savedSet: Set<string>;
  scheduledSet: Set<string>;
  wornSet: Set<string>;
  collectionsAddedSet: Set<string>;
  toggleSave: (id: string) => void;
  toggleSchedule: (id: string) => void;
  toggleWorn: (id: string) => void;
  toggleCollection: (id: string) => void;

  // Worn history — timestamped log of outfits marked as worn
  wornHistory: WornEntry[];
  markWorn: (outfitId: string) => void;

  // Date-to-outfit mapping for the schedule screen (dateKey → outfitId)
  scheduleMap: Record<string, string>;
  setScheduleOutfit: (dateKey: string, outfitId: string) => void;
  clearScheduleOutfit: (dateKey: string) => void;

  collections: Collection[];
  hydrate: () => Promise<void>;
}

interface Persisted {
  savedSet: string[];
  scheduledSet: string[];
  wornSet: string[];
  collectionsAddedSet: string[];
  scheduleMap: Record<string, string>;
  wornHistory: WornEntry[];
  userItems: ClothingItem[];
  collections: Collection[];
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
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}

export const useAppStore = create<AppState>((set) => ({
  hydrated: false,
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

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: Persisted = JSON.parse(raw);
        set({
          savedSet: new Set(data.savedSet ?? ['o2']),
          scheduledSet: new Set(data.scheduledSet ?? []),
          wornSet: new Set(data.wornSet ?? []),
          collectionsAddedSet: new Set(data.collectionsAddedSet ?? []),
          scheduleMap: data.scheduleMap ?? {},
          wornHistory: data.wornHistory ?? [],
          items: [...ITEMS, ...(data.userItems ?? [])],
          collections: data.collections ?? COLLECTIONS,
        });
      }
    } catch {
      // ignore parse errors
    } finally {
      set({ hydrated: true });
    }
  },
}));
